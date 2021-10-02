import { EventEmitter } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';
import { URL } from 'node:url';
import { CHAT_FUNCTION_BY_TYPE, INVISIBLE_CHARACTERS, MESSAGE_TYPES, PREFIX_BY_TYPE } from './constants';
import { MinecraftChatManager } from './managers/MinecraftChatManager';
import { DiscordManager } from './managers/DiscordManager';
import { EventCollection } from '../events/EventCollection';
import { logger } from '../../functions';
import type { Message as DiscordMessage, MessageOptions } from 'discord.js';
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
	discord?: DiscordMessageOptions;
	minecraft?: Omit<ChatOptions, 'content'>;
}

interface DiscordMessageOptions extends MessageOptions {
	prefix?: string;
}

export interface MessageForwardOptions {
	link?: DiscordChatManagerResolvable;
	/** player for muted and isStaff check */
	player?: Player;
	/** wether the message is an edit instead of a new message */
	isEdit?: boolean;
}


export class ChatBridge<loggedIn extends boolean = boolean> extends EventEmitter {
	/**
	 * increases each link cycle
	 */
	#guildLinkAttempts = 0;
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
	 * wether the minecraft bot and all discord channel managers (webhooks) are ready
	 */
	get ready() {
		return this.minecraft.isReady() && this.discord.ready;
	}

	/**
	 * bot ign | guild name
	 */
	get logInfo() {
		return `${this.bot?.username ?? 'no bot'} | ${this.hypixelGuild?.name ?? 'no guild'}`;
	}

	/**
	 * wether the guild has the chatBridge feature enabled
	 */
	get enabled() {
		return this.hypixelGuild?.chatBridgeEnabled ?? false;
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
		try {
			// link bot to db entry (create if non existant)
			this.minecraft.botPlayer ??= await (async () => {
				const [ player, created ] = await this.client.players.model.findCreateFind({
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

			logger.debug(`[CHATBRIDGE]: ${hypixelGuild.name}: linked to ${this.bot!.username}`);

			// instantiate DiscordChannelManagers
			await this.discord.init();

			this.#guildLinkAttempts = 0;

			return this;
		} catch (error) {
			logger.error(`[CHATBRIDGE LINK]: #${this.mcAccount}`, error);

			if (!this.shouldRetryLinking) {
				logger.error(`[CHATBRIDGE LINK]: #${this.mcAccount}: aborting retry due to a critical error`);
				return this;
			}

			await sleep(Math.min(++this.#guildLinkAttempts * 5_000, 300_000));

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
	handleDiscordMessage(message: DiscordMessage, { link = this.discord.get(message.channelId)!, ...options }: MessageForwardOptions = {}) {
		return (this.discord.resolve(link)?.forwardToMinecraft(message, options) && true) ?? false;
	}

	/**
	 * send a message both to discord and the in game guild chat, parsing both
	 * @param contentOrOptions
	 */
	broadcast(contentOrOptions: string | BroadcastOptions) {
		const {
			content,
			hypixelMessage,
			type = hypixelMessage?.type ?? MESSAGE_TYPES.GUILD,
			discord,
			minecraft: {
				prefix: minecraftPrefix = '',
				maxParts = Number.POSITIVE_INFINITY,
				...options
			} = {},
		} = typeof contentOrOptions === 'string'
			? { content: contentOrOptions } as BroadcastOptions
			: contentOrOptions;
		const discordChatManager = this.discord.resolve(type);

		return Promise.all([
			// minecraft
			this.minecraft[CHAT_FUNCTION_BY_TYPE[(discordChatManager?.type ?? type as keyof typeof CHAT_FUNCTION_BY_TYPE)]]?.({ content, prefix: minecraftPrefix, maxParts, ...options })
				?? this.minecraft.chat({
					content,
					prefix: `${discordChatManager?.prefix ?? PREFIX_BY_TYPE[(discordChatManager?.type ?? type as keyof typeof CHAT_FUNCTION_BY_TYPE)]} ${minecraftPrefix}${minecraftPrefix.length ? ' ' : INVISIBLE_CHARACTERS[0]}`,
					maxParts,
					...options,
				}),

			// discord
			discordChatManager?.sendViaBot({
				content,
				hypixelMessage,
				...discord,
			}),
		]);
	}
}
