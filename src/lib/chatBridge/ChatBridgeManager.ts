import { once } from 'node:events';
import { env } from 'node:process';
import { setInterval } from 'node:timers';
import type { URL } from 'node:url';
import { stripIndents } from 'common-tags';
import { InteractionType, MessageFlags, type Message, type Snowflake } from 'discord.js';
import { ChatBridge, ChatBridgeEvents } from './ChatBridge.js';
import { AbortControllerCache, OtherBotInteractionCache, OwnInteractionCache } from './caches/index.js';
import { DELETED_MESSAGE_REASON } from './constants/index.js';
import { DiscordChatManager } from './managers/DiscordChatManager.js';
import { UnicodeEmoji } from '#constants';
import { minutes } from '#functions';
import { logger } from '#logger';
import type { LunarClient } from '#structures/LunarClient.js';
import { BridgeCommandCollection } from '#structures/commands/BridgeCommandCollection.js';
import { type RepliableInteraction, MessageUtil } from '#utils';

export class ChatBridgeManager {
	/**
	 * the client that instantiated the ChatBridgeArray
	 */
	public declare readonly client: LunarClient;

	/**
	 * minecraft command collection
	 */
	public readonly commands: BridgeCommandCollection;

	/**
	 * discord channel ids of all ChatBridge channels
	 */
	public readonly channelIds = new Set<Snowflake>();

	/**
	 * webhook ids of all ChatBridge channels
	 */
	public readonly webhookIds = new Set<Snowflake>();

	/**
	 * individual chat bridges
	 */
	public readonly cache: ChatBridge[] = [];

	/**
	 * AbortControllers for discord messages
	 */
	public readonly abortControllers = new AbortControllerCache();

	/**
	 * CommandInteraction cache for this bot's interactions
	 */
	public readonly ownInteractionCache = new OwnInteractionCache();

	/**
	 * MessageInteraction cache for interactions from other bots
	 */
	public readonly otherBotInteractionCache = new OtherBotInteractionCache();

	/**
	 * interval to sweep this manager's and it's cached bridges' interaction caches
	 */
	// eslint-disable-next-line unicorn/consistent-function-scoping
	public readonly interactionCacheSweeperInterval = setInterval(() => {
		this.ownInteractionCache.sweep();
		this.otherBotInteractionCache.sweep();

		for (const { discord } of this.cache) {
			for (const { interactionUserCache } of discord.channels.values()) {
				interactionUserCache.sweep();
			}
		}
	}, minutes(10));

	public constructor(client: LunarClient, commandsURL: URL) {
		Object.defineProperty(this, 'client', { value: client });

		this.commands = new BridgeCommandCollection(client, commandsURL);

		for (let index = 0; index < this._accounts.length; ++index) {
			this.cache.push(new ChatBridge(client, this, index));
		}
	}

	/**
	 * mc accounts
	 */
	private get _accounts() {
		return env.MINECRAFT_ACCOUNT_TYPE.split(/\s+/).filter(Boolean);
	}

	/**
	 * loads channelIds from hypixelGuilds
	 */
	public loadChannelIds() {
		this.channelIds.clear();

		for (const { chatBridgeChannels } of this.client.hypixelGuilds.cache.values()) {
			for (const { channelId } of chatBridgeChannels) {
				this.channelIds.add(channelId);
			}
		}

		return this;
	}

	/**
	 * connects a single or all bridges, instantiating them first if not already done
	 *
	 * @param indexOrForce
	 * @param force
	 */
	public async connect(index: number, force?: boolean): Promise<this>;
	public async connect(force?: boolean): Promise<this>;
	public async connect(indexOrForce?: boolean | number, force?: boolean) {
		await this.commands.loadAll();

		// single
		if (typeof indexOrForce === 'number') {
			if (indexOrForce < 0 || indexOrForce >= this.cache.length) {
				throw new Error(`no ChatBridge with index #${indexOrForce}`);
			}

			const chatBridge = this.cache[indexOrForce]!;

			await chatBridge.connect(force);
			await once(chatBridge, ChatBridgeEvents.Ready);

			return this;
		}

		// all
		await Promise.all(
			this.cache.map(async (chatBridge) => {
				await chatBridge.connect(indexOrForce);
				return once(chatBridge, ChatBridgeEvents.Ready);
			}),
		);

		return this;
	}

	/**
	 * disconnects a single or all bridges
	 *
	 * @param indexOrErrored
	 * @param errored
	 */
	public disconnect(index: number, errored?: boolean): ChatBridge;
	public disconnect(errored?: boolean): ChatBridge[];
	public disconnect(indexOrErrored?: boolean | number, errored?: boolean) {
		// single
		if (typeof indexOrErrored === 'number') {
			if (indexOrErrored < 0 || indexOrErrored >= this.cache.length) {
				throw new Error(`no ChatBridge with index #${indexOrErrored}`);
			}

			const chatBridge = this.cache[indexOrErrored]!;
			return chatBridge.disconnect(errored);
		}

		// all
		return this.cache.map((chatBridge) => chatBridge.disconnect(indexOrErrored));
	}

	/**
	 * forwards announcement messages to all chatBridges (via broadcast)
	 *
	 * @param message
	 */
	public async handleAnnouncementMessage(message: Message) {
		if (!message.content) {
			return void MessageUtil.react(message, UnicodeEmoji.Stop);
		}

		const res: boolean[] = [];

		// broadcast messages
		for (const hypixelGuild of this.client.hypixelGuilds.cache.values()) {
			if (hypixelGuild.announcementsChannelId !== message.channelId) continue;

			try {
				const [minecraftResult, discordResult] = await hypixelGuild.chatBridge.broadcast({
					content: stripIndents`
						${message.content}
						~ ${await DiscordChatManager.getPlayerName(message)}
					`,
					minecraft: {
						prefix: 'Guild_Announcement:',
						maxParts: Number.POSITIVE_INFINITY,
					},
				});

				res.push(minecraftResult && discordResult !== null);
			} catch (error) {
				logger.error({ err: error, hypixelGuild: hypixelGuild.logInfo }, '[HANDLE ANNOUNCEMENT MESSAGE]');
				res.push(false);
			}
		}

		// handle results
		if (res.length && !res.includes(false)) {
			// remove :x: reaction from bot if existent
			const errorReaction = message.reactions.cache.get(UnicodeEmoji.X);

			if (errorReaction?.me) {
				errorReaction.users
					.remove(this.client.user!)
					.catch((error) => logger.error(error, '[HANDLE ANNOUNCEMENT MESSAGE]'));
			}
		} else {
			void MessageUtil.react(message, UnicodeEmoji.X);
		}
	}

	/**
	 * whether the message is not for a bridge channel, from a bridge webhook or all bridges are disabled
	 *
	 * @param message
	 */
	public shouldIgnoreMessage(message: Pick<Message, 'channelId' | 'id' | 'webhookId'>) {
		return (
			!this.channelIds.has(message.channelId) ||
			(message.webhookId && this.webhookIds.has(message.webhookId)) ||
			!this.client.config.get('CHATBRIDGE_ENABLED')
		);
	}

	/**
	 * forwards the discord message if a chat bridge for that channel is found
	 *
	 * @param message
	 */
	public async handleDiscordMessage(message: Message) {
		if (this.shouldIgnoreMessage(message)) return; // not a chat bridge message or bridge disabled
		if (message.flags.any(MessageFlags.Ephemeral | MessageFlags.Loading)) return; // ignore ephemeral and loading (deferred, embeds missing, etc) messages
		if (MessageUtil.isNormalBotMessage(message)) return; // ignore non application command messages from the bot

		const { signal } = this.abortControllers.get(message.id);

		if (signal.aborted) return; // ignore deleted messages

		const res = await Promise.all(
			this.cache.map(async (chatBridge) => chatBridge.handleDiscordMessage(message, signal)),
		);

		if (res.includes(true)) return;

		// no chat bridge found to handle the message
		void MessageUtil.react(message, UnicodeEmoji.X);
	}

	/**
	 * aborts the AbortController if the message was sent in a bridge channel
	 *
	 * @param message
	 */
	public handleMessageDelete(message: Pick<Message, 'channelId' | 'createdTimestamp' | 'id' | 'webhookId'>) {
		if (this.shouldIgnoreMessage(message)) return; // not a chat bridge message or bridge disabled

		this.abortControllers.abort(message, DELETED_MESSAGE_REASON);
	}

	/**
	 * caches interactions in chat bridge channels
	 *
	 * @param interaction
	 */
	public handleInteractionCreate(interaction: RepliableInteraction) {
		if (!this.channelIds.has(interaction.channelId)) return;

		if (interaction.isCommand()) this.ownInteractionCache.add(interaction);

		for (const chatBridge of this.cache) {
			chatBridge.discord.channelsByIds.get(interaction.channelId!)?.interactionUserCache.add(interaction);
		}
	}

	/**
	 * caches interactions in chat bridge channels
	 *
	 * @param message
	 */
	public handleInteractionRepliesFromOtherBots(
		message: Message & { interaction: NonNullable<Message['interaction']> },
	) {
		if (!this.channelIds.has(message.channelId)) return;

		if (message.interaction.type === InteractionType.ApplicationCommand) {
			this.otherBotInteractionCache.add(message.interaction);
		}
	}
}
