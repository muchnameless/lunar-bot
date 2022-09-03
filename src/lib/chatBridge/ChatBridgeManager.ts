import { once } from 'node:events';
import { env } from 'node:process';
import { setInterval } from 'node:timers';
import { type URL } from 'node:url';
import { stripIndents } from 'common-tags';
import { MessageFlags, type Message, type Snowflake } from 'discord.js';
import { ChatBridge, ChatBridgeEvent, type MessageForwardOptions } from './ChatBridge.js';
import { AbortControllerCache } from './caches/AbortControllerCache.js';
import { InteractionCache } from './caches/InteractionCache.js';
import { DELETED_MESSAGE_REASON } from './constants/index.js';
import { DiscordChatManager } from './managers/DiscordChatManager.js';
import { UnicodeEmoji } from '#constants';
import { minutes } from '#functions';
import { logger } from '#logger';
import { type LunarClient } from '#structures/LunarClient.js';
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
	 * interaction cache
	 */
	public readonly interactionCache = new InteractionCache();

	/**
	 * interval to sweep this manager's and it's cached bridges' interaction caches
	 */
	// eslint-disable-next-line unicorn/consistent-function-scoping
	public readonly interactionCacheSweeperInterval = setInterval(() => {
		this.interactionCache.sweep();

		for (const { discord } of this.cache) {
			for (const { interactionUserCache } of discord.channels.values()) {
				interactionUserCache.sweep();
			}
		}
	}, minutes(15));

	public constructor(client: LunarClient, commandsURL: URL) {
		Object.defineProperty(this, 'client', { value: client });

		this.commands = new BridgeCommandCollection(client, commandsURL);

		for (let index = 0; index < ChatBridgeManager._accounts.length; ++index) {
			this.cache.push(new ChatBridge(client, this, index));
		}
	}

	/**
	 * mc accounts
	 */
	private static get _accounts() {
		return env.MINECRAFT_ACCOUNT_TYPE!.split(/\s+/).filter(Boolean);
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
	 * @param index
	 */
	public async connect(index?: number) {
		// load commands if none are present
		await this.commands.loadAll();

		// single
		if (typeof index === 'number' && index >= 0 && index < ChatBridgeManager._accounts.length) {
			const chatBridge = this.cache[index]!;

			await chatBridge.connect();
			await once(chatBridge, ChatBridgeEvent.Ready);

			return this;
		}

		// all
		await Promise.all(
			this.cache.map(async (chatBridge) => {
				await chatBridge.connect();
				return once(chatBridge, ChatBridgeEvent.Ready);
			}),
		);

		return this;
	}

	/**
	 * disconnects a single or all bridges
	 *
	 * @param index
	 */
	public disconnect(index?: undefined): ChatBridge[];
	public disconnect(index: number): ChatBridge;
	public disconnect(index?: number) {
		// single
		if (typeof index === 'number') {
			const chatBridge = this.cache[index];
			if (!chatBridge) throw new Error(`no chatBridge with index #${index}`);
			return chatBridge.disconnect();
		}

		// all
		return this.cache.map((chatBridge) => chatBridge.disconnect());
	}

	/**
	 * forwards announcement messages to all chatBridges (via broadcast)
	 *
	 * @param message
	 */
	public async handleAnnouncementMessage(message: Message) {
		if (!message.content) {
			MessageUtil.react(message, UnicodeEmoji.Stop);
			return;
		}

		const res: boolean[] = [];

		// broadcast messages
		for (const hypixelGuild of this.client.hypixelGuilds.cache.values()) {
			if (hypixelGuild.announcementsChannelId !== message.channelId) continue;

			try {
				const [minecraftResult, discordResult] = await hypixelGuild.chatBridge.broadcast({
					content: stripIndents`
						${message.content}
						~ ${DiscordChatManager.getPlayerName(message)}
					`,
					discord: {
						allowedMentions: { parse: [] },
					},
					minecraft: {
						prefix: 'Guild_Announcement:',
						maxParts: Number.POSITIVE_INFINITY,
					},
				});

				res.push(minecraftResult && Boolean(discordResult));
			} catch (error) {
				logger.error(error, `[HANDLE ANNOUNCEMENT MSG]: ${hypixelGuild}`);
				res.push(false);
			}
		}

		// handle results
		if (res.length && !res.includes(false)) {
			// remove :x: reaction from bot if existant
			if (message.reactions.cache.get(UnicodeEmoji.X)?.me) {
				message.reactions.cache
					.get(UnicodeEmoji.X)!
					.users.remove(this.client.user!)
					.catch((error) => logger.error(error, '[HANDLE ANNOUNCEMENT MSG]'));
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
	 * @param options
	 */
	public async handleDiscordMessage(message: Message, options?: MessageForwardOptions) {
		if (this.shouldIgnoreMessage(message)) return; // not a chat bridge message or bridge disabled
		if (message.flags.any(MessageFlags.Ephemeral | MessageFlags.Loading)) return; // ignore ephemeral and loading (deferred, embeds missing, etc) messages
		if (MessageUtil.isNormalBotMessage(message)) return; // ignore non application command messages from the bot

		const _options = {
			signal: this.abortControllers.get(message.id).signal,
			...options,
		};

		if (_options.signal.aborted) return; // ignore deleted messages

		const res = await Promise.all(
			this.cache.map(async (chatBridge) => chatBridge.handleDiscordMessage(message, _options)),
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
		if (!this.channelIds.has(interaction.channelId!)) return;

		if (interaction.isChatInputCommand()) this.interactionCache.add(interaction);

		for (const chatBridge of this.cache) {
			chatBridge.discord.channelsByIds.get(interaction.channelId!)?.interactionUserCache.add(interaction);
		}
	}
}
