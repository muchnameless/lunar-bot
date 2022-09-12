import { EventEmitter, once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';
import { URL } from 'node:url';
import { type Awaitable, type Message as DiscordMessage, type MessageOptions } from 'discord.js';
import { type Client as MinecraftBot } from 'minecraft-protocol';
import { type ChatBridgeManager } from './ChatBridgeManager.js';
import { type HypixelMessage } from './HypixelMessage.js';
import { HypixelMessageType, PREFIX_BY_TYPE } from './constants/index.js';
import { DiscordManager, type ReadyDiscordManager } from './managers/DiscordManager.js';
import {
	MinecraftChatManager,
	type MinecraftChatOptions,
	type ReadyMinecraftChatManager,
} from './managers/MinecraftChatManager.js';
import { UnicodeEmoji } from '#constants';
import { minutes, seconds } from '#functions';
import { logger } from '#logger';
import { type LunarClient } from '#structures/LunarClient.js';
import { type HypixelGuild } from '#structures/database/models/HypixelGuild.js';
import { type Player } from '#structures/database/models/Player.js';
import { EventCollection } from '#structures/events/EventCollection.js';
import { MessageUtil } from '#utils';

export interface BroadcastOptions {
	content: string;
	discord?: Omit<MessageOptions, 'content'>;
	hypixelMessage?: HypixelMessage | null;
	minecraft?: Omit<MinecraftChatOptions, 'content'>;
}

export const enum ChatBridgeEvent {
	Connect = 'connect',
	Disconnect = 'disconnect',
	Error = 'error',
	Linked = 'linked',
	Message = 'message',
	Ready = 'ready',
}

export interface ChatBridge {
	on(event: ChatBridgeEvent.Connect | ChatBridgeEvent.Ready, listener: () => Awaitable<void>): this;
	on(event: ChatBridgeEvent.Disconnect, listener: (reason?: string) => Awaitable<void>): this;
	on(event: ChatBridgeEvent.Error, listener: (error: Error) => Awaitable<void>): this;
	on(event: ChatBridgeEvent.Message, listener: (hypixelMessage: HypixelMessage) => Awaitable<void>): this;
}

export interface MinecraftReadyChatBridge extends ChatBridge {
	get bot(): MinecraftBot;
	minecraft: ReadyMinecraftChatManager;
	get player(): Player;
}

export interface DiscordReadyChatBridge extends ChatBridge {
	discord: ReadyDiscordManager;
}

export type ReadyChatBridge = DiscordReadyChatBridge & MinecraftReadyChatBridge;

export class ChatBridge extends EventEmitter {
	/**
	 * increases each link cycle
	 */
	private guildLinkAttempts = 0;

	/**
	 * client that instantiated the chat bridge
	 */
	public declare readonly client: LunarClient;

	/**
	 * manager that instantiated the chat bridge
	 */
	public readonly manager: ChatBridgeManager;

	/**
	 * position in the mcAccount array
	 */
	public mcAccount: number;

	/**
	 * linked hypixel guild
	 */
	public hypixelGuild: HypixelGuild | null = null;

	/**
	 * whether to retry linking the chat bridge to a guild
	 */
	public shouldRetryLinking = true;

	/**
	 * minecraft related functions
	 */
	public readonly minecraft = new MinecraftChatManager(this);

	/**
	 * discord related functions
	 */
	public readonly discord = new DiscordManager(this);

	/**
	 * ChatBridge events
	 */
	private readonly events = new EventCollection(this, new URL('events/', import.meta.url));

	public constructor(client: LunarClient, manager: ChatBridgeManager, mcAccount: number) {
		super({ captureRejections: true });

		Object.defineProperty(this, 'client', { value: client });

		this.manager = manager;
		this.mcAccount = mcAccount;
		void this.events.loadAll();
	}

	/**
	 * bot ign | guild name
	 */
	public get logInfo() {
		return {
			bot: this.minecraft.botUsername,
			botUuid: this.minecraft.botUuid,
			hypixelGuild: this.hypixelGuild?.logInfo ?? null,
			mcAccount: this.mcAccount,
		};
	}

	/**
	 * player object associated with the chatBridge's bot
	 */
	public get player() {
		return this.minecraft.botPlayer;
	}

	/**
	 * minecraft bot
	 */
	public get bot() {
		return this.minecraft.bot;
	}

	/**
	 * whether the minecraft bot is ready and logged in
	 */
	public isMinecraftReady(): this is MinecraftReadyChatBridge {
		return this.minecraft.isReady();
	}

	/**
	 * whether all discord channels are ready
	 */
	public isDiscordReady(): this is DiscordReadyChatBridge {
		return this.discord.isReady();
	}

	/**
	 * whether the minecraft bot and all discord channels are ready
	 */
	public isReady(): this is ReadyChatBridge {
		return this.isMinecraftReady() && this.isDiscordReady();
	}

	/**
	 * whether the guild has the chatBridge feature enabled
	 */
	public isEnabled(): this is ChatBridge & { hypixelGuild: HypixelGuild } {
		return this.hypixelGuild?.chatBridgeEnabled ?? false;
	}

	/**
	 * create and log the bot into hypixel
	 */
	public async connect() {
		await this.minecraft.connect();
		return this;
	}

	/**
	 * destroys the connection to the guild and reconnects the bot
	 */
	public async reconnect(...args: Parameters<MinecraftChatManager['reconnect']>) {
		await this.minecraft.reconnect(...args);
		return this;
	}

	/**
	 * disconnects the bot and resets the chatBridge
	 */
	public disconnect() {
		this.unlink();
		this.minecraft.disconnect();
		return this;
	}

	/**
	 * links this chatBridge with the bot's guild
	 *
	 * @param guildName
	 */
	public async link(guildName: string | null = null): Promise<this> {
		if (!this.isMinecraftReady()) {
			await once(this, ChatBridgeEvent.Ready);
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

				logger.error(this.logInfo, '[CHATBRIDGE]: no matching guild found');
				return this;
			}

			// already linked to this guild
			if (hypixelGuild.guildId === this.hypixelGuild?.guildId) {
				logger.debug(this.logInfo, '[CHATBRIDGE]: already linked');
				return this;
			}

			hypixelGuild.chatBridge = this;
			this.hypixelGuild = hypixelGuild;

			this.emit(ChatBridgeEvent.Linked);

			logger.info(this.logInfo, '[CHATBRIDGE]: linked');

			// instantiate DiscordChannelManagers
			await this.discord.init();

			this.guildLinkAttempts = 0;

			return this;
		} catch (error) {
			logger.error({ err: error, ...this.logInfo }, '[CHATBRIDGE LINK]');

			if (!this.shouldRetryLinking) {
				logger.error(this.logInfo, '[CHATBRIDGE LINK]: aborting retry due to a critical error');
				return this;
			}

			await sleep(Math.min(++this.guildLinkAttempts * seconds(5), minutes(5)));

			return this.link(guildName);
		}
	}

	/**
	 * unlinks the chatBridge from the linked guild
	 */
	public unlink() {
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
	public incrementMaxListeners() {
		const maxListeners = this.getMaxListeners();

		if (maxListeners !== 0) this.setMaxListeners(maxListeners + 1);
	}

	/**
	 * Decrements max listeners by one, if they are not zero.
	 */
	public decrementMaxListeners() {
		const maxListeners = this.getMaxListeners();

		if (maxListeners !== 0) this.setMaxListeners(maxListeners - 1);
	}

	/**
	 * reacts with :X: if this ChatBridge is responsible for handling the message
	 *
	 * @param message
	 */
	public handleError(message: DiscordMessage) {
		if (!this.discord.channelsByIds.has(message.channelId)) return false;

		void MessageUtil.react(message, UnicodeEmoji.X);
		return true;
	}

	/**
	 * forwards the discord message to minecraft chat if the ChatBridge has a DiscordChatManager for the message's channel, returning true if so, false otherwise
	 *
	 * @param message
	 * @param signal
	 * @returns true if the ChatBridge handled the message, false otherwise
	 */
	public async handleDiscordMessage(message: DiscordMessage, signal: AbortSignal) {
		if (!this.hypixelGuild?.chatBridgeEnabled) {
			// linked but not enabled
			if (this.hypixelGuild) return this.handleError(message);

			// not linked yet
			try {
				await once(this, ChatBridgeEvent.Linked, { signal: AbortSignal.timeout(minutes(1)) });
			} catch (error) {
				logger.error({ err: error, ...this.logInfo }, '[HANDLE DISCORD MESSAGE]: not linked');
				return this.handleError(message);
			}
		}

		// mc bot not ready yet
		if (!this.isMinecraftReady()) {
			try {
				await once(this, ChatBridgeEvent.Ready, { signal: AbortSignal.timeout(minutes(1)) });
			} catch (error) {
				logger.error({ err: error, ...this.logInfo }, '[HANDLE DISCORD MESSAGE]: minecraft not ready');
				return this.handleError(message);
			}
		}

		const discordChatManager = this.discord.channelsByIds.get(message.channelId);
		if (!discordChatManager) return false;

		void discordChatManager.forwardToMinecraft(message, signal);
		return true;
	}

	/**
	 * send a message both to discord and the in-game guild chat, parsing both
	 *
	 * @param options
	 */
	public async broadcast(options: BroadcastOptions | string) {
		const {
			content,
			discord,
			hypixelMessage,
			minecraft: { prefix, maxParts = Number.POSITIVE_INFINITY, ...minecraft } = {},
		} = typeof options === 'string' ? ({ content: options } as BroadcastOptions) : options;
		const type = hypixelMessage?.type ?? HypixelMessageType.Guild;

		return Promise.all([
			// minecraft
			this.minecraft.chat({
				content,
				prefix: prefix ? `${PREFIX_BY_TYPE[type]}${prefix} ` : PREFIX_BY_TYPE[type],
				maxParts,
				...minecraft,
			}),

			// discord
			this.discord.resolve(type)?.sendViaBot({
				content,
				hypixelMessage,
				...discord,
			}) ?? null,
		]);
	}
}
