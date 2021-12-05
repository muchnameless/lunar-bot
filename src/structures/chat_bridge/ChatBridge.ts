import { setTimeout as sleep } from 'node:timers/promises';
import { URL } from 'node:url';
import { TypedEmitter } from 'tiny-typed-emitter';
import { EventCollection } from '../events/EventCollection';
import { logger, minutes, seconds } from '../../functions';
import { CHAT_FUNCTION_BY_TYPE, INVISIBLE_CHARACTERS, MESSAGE_TYPES, PREFIX_BY_TYPE } from './constants';
import { MinecraftChatManager } from './managers/MinecraftChatManager';
import { DiscordManager } from './managers/DiscordManager';
import type { Awaitable, Message as DiscordMessage, MessageOptions } from 'discord.js';
import type { LunarClient } from '../LunarClient';
import type { HypixelGuild } from '../database/models/HypixelGuild';
import type { SendToChatOptions } from './managers/MinecraftChatManager';
import type { DiscordChatManagerResolvable } from './managers/DiscordManager';
import type { HypixelMessage } from './HypixelMessage';
import type { Player } from '../database/models/Player';

export interface ChatOptions extends SendToChatOptions {
	maxParts?: number;
}

export interface BroadcastOptions {
	content: string;
	type?: DiscordChatManagerResolvable;
	hypixelMessage?: HypixelMessage | null;
	discord?: MessageOptions;
	minecraft?: Omit<ChatOptions, 'content'>;
}

export interface MessageForwardOptions {
	link?: DiscordChatManagerResolvable;
	/** player for muted and isStaff check */
	player?: Player;
	/** wether the message is an edit instead of a new message */
	isEdit?: boolean;
}

export const enum ChatBridgeEvents {
	CONNECT = 'connect',
	DISCONNECT = 'disconnect',
	ERROR = 'error',
	MESSAGE = 'message',
	READY = 'ready',
}

interface ChatBridgeEventListeners {
	[ChatBridgeEvents.CONNECT]: () => Awaitable<void>;
	[ChatBridgeEvents.DISCONNECT]: (reason?: string) => Awaitable<void>;
	[ChatBridgeEvents.ERROR]: (error: Error) => Awaitable<void>;
	[ChatBridgeEvents.MESSAGE]: (hypixelMessage: HypixelMessage) => Awaitable<void>;
	[ChatBridgeEvents.READY]: () => Awaitable<void>;
	string: (...args: unknown[]) => Awaitable<void>;
}

export class ChatBridge<loggedIn extends boolean = boolean> extends TypedEmitter<ChatBridgeEventListeners> {
	/**
	 * increases each link cycle
	 */
	guildLinkAttempts = 0;
	/**
	 * client that instantiated the chat bridge
	 */
	client: LunarClient;
	/**
	 * position in the mcAccount array
	 */
	mcAccount: number;
	/**
	 * linked hypixel guild
	 */
	hypixelGuild: HypixelGuild | null = null;
	/**
	 * wether to retry linking the chat bridge to a guild
	 */
	shouldRetryLinking = true;
	/**
	 * timestamp of the end of the current poll, if existing
	 */
	pollUntil: number | null = null;
	/**
	 * minecraft related functions
	 */
	minecraft: MinecraftChatManager<loggedIn> = new MinecraftChatManager(this);
	/**
	 * discord related functions
	 */
	discord: DiscordManager = new DiscordManager(this);
	events = new EventCollection(this, new URL('./events', import.meta.url));

	constructor(client: LunarClient, mcAccount: number) {
		super();

		this.client = client;
		this.mcAccount = mcAccount;
		this.events.loadAll();
	}

	/**
	 * bot ign | guild name
	 */
	get logInfo() {
		return `${this.bot?.username ?? 'no bot'} | ${this.hypixelGuild ?? 'no guild'}`;
	}

	/**
	 * player object associated with the chatBridge's bot
	 */
	get player() {
		return this.minecraft.botPlayer;
	}

	/**
	 * minecraft bot
	 */
	get bot() {
		return this.minecraft.bot;
	}

	/**
	 * wether the minecraft bot and all discord channel managers (webhooks) are ready
	 */
	isReady(): this is ChatBridge<true> {
		return this.minecraft.isReady() && this.discord.ready;
	}

	/**
	 * wether the guild has the chatBridge feature enabled
	 */
	isEnabled(): this is ChatBridge & { hypixelGuild: HypixelGuild } {
		return this.hypixelGuild?.chatBridgeEnabled ?? false;
	}

	/**
	 * create and log the bot into hypixel
	 */
	async connect() {
		await this.minecraft.connect();
		return this;
	}

	/**
	 * destroys the connection to the guild and reconnects the bot
	 */
	get reconnect() {
		return this.minecraft.reconnect.bind(this.minecraft);
	}

	/**
	 * disconnects the bot and resets the chatBridge
	 */
	disconnect() {
		this.unlink();
		this.minecraft.disconnect();
		return this;
	}

	/**
	 * links this chatBridge with the bot's guild
	 * @param guildName
	 */
	async link(guildName: string | null = null): Promise<this> {
		if (!this.minecraft.isReady()) {
			await sleep(Math.min(++this.guildLinkAttempts * seconds(5), minutes(5)));

			return this.link(guildName);
		}

		try {
			// link bot to db entry (create if non existant)
			this.minecraft.botPlayer ??= await (async () => {
				const [player, created] = await this.client.players.model.findCreateFind({
					where: { minecraftUuid: this.minecraft.botUuid },
					defaults: {
						minecraftUuid: this.minecraft.botUuid!,
						ign: this.bot!.username,
					},
				});

				if (created) this.client.players.set(player.minecraftUuid, player);

				return player;
			})();

			// guild to link to
			const hypixelGuild = guildName
				? this.client.hypixelGuilds.cache.find(({ name }) => name === guildName)
				: this.client.hypixelGuilds.cache.find(({ players }) => players.has(this.minecraft.botUuid!));

			// no guild found
			if (!hypixelGuild) {
				this.unlink();

				logger.error(`[CHATBRIDGE]: ${this.bot!.username}: no matching guild found`);
				return this;
			}

			// already linked to this guild
			if (hypixelGuild.guildId === this.hypixelGuild?.guildId) {
				logger.debug(`[CHATBRIDGE]: ${this.logInfo}: already linked`);
				return this;
			}

			hypixelGuild.chatBridge = this;
			this.hypixelGuild = hypixelGuild;

			logger.debug(`[CHATBRIDGE]: ${hypixelGuild}: linked to ${this.bot!.username}`);

			// instantiate DiscordChannelManagers
			await this.discord.init();

			this.guildLinkAttempts = 0;

			return this;
		} catch (error) {
			logger.error(error, `[CHATBRIDGE LINK]: #${this.mcAccount}`);

			if (!this.shouldRetryLinking) {
				logger.error(`[CHATBRIDGE LINK]: #${this.mcAccount}: aborting retry due to a critical error`);
				return this;
			}

			await sleep(Math.min(++this.guildLinkAttempts * seconds(5), minutes(5)));

			return this.link(guildName);
		}
	}

	/**
	 * unlinks the chatBridge from the linked guild
	 */
	unlink() {
		this.discord.ready = false;
		if (this.hypixelGuild) this.hypixelGuild.chatBridge = null;
		this.hypixelGuild = null;

		// clear DiscordChatManagers
		// this.discord.channelsByIds.clear();
		// this.discord.channelsByType.clear();

		return this;
	}

	/**
	 * Increments max listeners by one, if they are not zero.
	 */
	incrementMaxListeners() {
		const maxListeners = this.getMaxListeners();

		if (maxListeners !== 0) this.setMaxListeners(maxListeners + 1);
	}

	/**
	 * Decrements max listeners by one, if they are not zero.
	 */
	decrementMaxListeners() {
		const maxListeners = this.getMaxListeners();

		if (maxListeners !== 0) this.setMaxListeners(maxListeners - 1);
	}

	/**
	 * forwards the discord message to minecraft chat if the ChatBridge has a DiscordChatManager for the message's channel, returning true if so, false otherwise
	 * @param message
	 * @param options
	 */
	handleDiscordMessage(message: DiscordMessage, options: MessageForwardOptions = {}) {
		return Boolean(this.discord.channelsByIds.get(message.channelId)?.forwardToMinecraft(message, options));
	}

	/**
	 * send a message both to discord and the in game guild chat, parsing both
	 * @param options
	 */
	broadcast(options: string | BroadcastOptions) {
		const {
			content,
			hypixelMessage,
			type = hypixelMessage?.type ?? MESSAGE_TYPES.GUILD,
			discord,
			minecraft: { prefix: minecraftPrefix = '', maxParts = Number.POSITIVE_INFINITY, ..._options } = {},
		} = typeof options === 'string' ? ({ content: options } as BroadcastOptions) : options;
		const discordChatManager = this.discord.resolve(type);

		return Promise.all([
			// minecraft
			this.minecraft[CHAT_FUNCTION_BY_TYPE[discordChatManager?.type ?? (type as keyof typeof CHAT_FUNCTION_BY_TYPE)]]?.(
				{ content, prefix: minecraftPrefix, maxParts, ..._options },
			) ??
				this.minecraft.chat({
					content,
					prefix: `${
						discordChatManager?.prefix ??
						PREFIX_BY_TYPE[discordChatManager?.type ?? (type as keyof typeof CHAT_FUNCTION_BY_TYPE)]
					} ${minecraftPrefix}${minecraftPrefix.length ? ' ' : INVISIBLE_CHARACTERS[0]}`,
					maxParts,
					..._options,
				}),

			// discord
			discordChatManager?.sendViaBot({
				// @ts-expect-error idk why content is of type 'string | null' here
				content,
				hypixelMessage,
				...discord,
			}) ?? null,
		]);
	}
}
