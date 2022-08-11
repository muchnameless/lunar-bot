import { setTimeout as sleep } from 'node:timers/promises';
import { URL } from 'node:url';
import { EventEmitter } from 'node:events';
import { logger } from '#logger';
import { EventCollection } from '#structures/events/EventCollection';
import { minutes, seconds } from '#functions';
import { CHAT_FUNCTION_BY_TYPE, INVISIBLE_CHARACTERS, HypixelMessageType, PREFIX_BY_TYPE } from './constants';
import { MinecraftChatManager } from './managers/MinecraftChatManager';
import { DiscordManager } from './managers/DiscordManager';
import type { Awaitable, Message as DiscordMessage, MessageOptions } from 'discord.js';
import type { LunarClient } from '#structures/LunarClient';
import type { HypixelGuild } from '#structures/database/models/HypixelGuild';
import type { Player } from '#structures/database/models/Player';
import type { DiscordChatManagerResolvable } from './managers/DiscordManager';
import type { HypixelMessage } from './HypixelMessage';
import type { MinecraftChatOptions } from './managers/MinecraftChatManager';

export interface BroadcastOptions {
	content: string;
	type?: DiscordChatManagerResolvable;
	hypixelMessage?: HypixelMessage | null;
	discord?: Omit<MessageOptions, 'content'>;
	minecraft?: Omit<MinecraftChatOptions, 'content'>;
}

export interface MessageForwardOptions {
	link?: DiscordChatManagerResolvable;
	/** player for muted and isStaff check */
	player?: Player;
	/** whether the message is an edit instead of a new message */
	isEdit?: boolean;
}

export const enum ChatBridgeEvent {
	Connect = 'connect',
	Disconnect = 'disconnect',
	Error = 'error',
	Message = 'message',
	Ready = 'ready',
}

export interface ChatBridge {
	on(event: ChatBridgeEvent.Connect, listener: () => Awaitable<void>): this;
	on(event: ChatBridgeEvent.Disconnect, listener: (reason?: string) => Awaitable<void>): this;
	on(event: ChatBridgeEvent.Error, listener: (error: Error) => Awaitable<void>): this;
	on(event: ChatBridgeEvent.Message, listener: (hypixelMessage: HypixelMessage) => Awaitable<void>): this;
	on(event: ChatBridgeEvent.Ready, listener: () => Awaitable<void>): this;
}

export class ChatBridge<loggedIn extends boolean = boolean> extends EventEmitter {
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
	 * whether to retry linking the chat bridge to a guild
	 */
	shouldRetryLinking = true;
	/**
	 * minecraft related functions
	 */
	minecraft: MinecraftChatManager<loggedIn> = new MinecraftChatManager(this);
	/**
	 * discord related functions
	 */
	discord: DiscordManager = new DiscordManager(this);
	/**
	 * ChatBridge events
	 */
	events = new EventCollection(this, new URL('./events/', import.meta.url));

	constructor(client: LunarClient, mcAccount: number) {
		super({ captureRejections: true });

		this.client = client;
		this.mcAccount = mcAccount;
		void this.events.loadAll();
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
	 * whether the minecraft bot and all discord channel managers (webhooks) are ready
	 */
	isReady(): this is ChatBridge<true> {
		return this.minecraft.isReady() && this.discord.ready;
	}

	/**
	 * whether the guild has the chatBridge feature enabled
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
	async reconnect(...args: Parameters<MinecraftChatManager['reconnect']>) {
		await this.minecraft.reconnect(...args);
		return this;
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
		while (!this.minecraft.isReady()) {
			await sleep(Math.min(++this.guildLinkAttempts * seconds(5), minutes(5)));
		}

		try {
			// link bot to db entry (create if non existant)
			this.minecraft.botPlayer ??= await (async () => {
				const [player, created] = await this.client.players.model.findCreateFind({
					where: { minecraftUuid: this.minecraft.botUuid! },
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

			logger.info(`[CHATBRIDGE]: ${hypixelGuild}: linked to ${this.bot!.username}`);

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
	 * send a message both to discord and the in-game guild chat, parsing both
	 * @param options
	 */
	broadcast(options: string | BroadcastOptions) {
		const {
			content,
			hypixelMessage,
			type = hypixelMessage?.type ?? HypixelMessageType.Guild,
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
				content,
				hypixelMessage,
				...discord,
			}) ?? null,
		]);
	}
}
