import { once } from 'node:events';
import { env } from 'node:process';
import { clearTimeout, setInterval, setTimeout } from 'node:timers';
import { stripIndents } from 'common-tags';
import { Collection, MessageFlags, SnowflakeUtil } from 'discord.js';
import { MessageUtil } from '#utils';
import { logger } from '#logger';
import { UnicodeEmoji } from '#constants';
import { BridgeCommandCollection } from '#structures/commands/BridgeCommandCollection';
import { minutes } from '#functions';
import { ChatBridge, ChatBridgeEvent } from './ChatBridge';
import { DiscordChatManager } from './managers/DiscordChatManager';
import { DELETED_MESSAGE_REASON } from './constants';
import type { URL } from 'node:url';
import type { ChatInputCommandInteraction, Message, Snowflake } from 'discord.js';
import type { MessageForwardOptions } from './ChatBridge';
import type { LunarClient } from '#structures/LunarClient';

class InteractionCache {
	private _cache = new Map<
		Snowflake,
		{ interaction: ChatInputCommandInteraction<'cachedOrDM'>; timeout: NodeJS.Timeout }
	>();
	private _channelIds: ChatBridgeManager['channelIds'];

	constructor({ channelIds }: ChatBridgeManager) {
		this._channelIds = channelIds;
	}

	/**
	 * adds the interaction to the cache if the channel is a chat bridge channel
	 * @param interaction
	 */
	add(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		if (!this._channelIds.has(interaction.channelId)) return;

		this._cache.set(interaction.id, {
			interaction,
			timeout: setTimeout(() => this._cache.delete(interaction.id), minutes(15)),
		});
	}

	/**
	 * retrieves an interaction from the cache and deletes it from the cache if found
	 * @param interactionId
	 */
	get(interactionId: Snowflake) {
		const cached = this._cache.get(interactionId);
		if (!cached) return null;

		this._cache.delete(interactionId);
		clearTimeout(cached.timeout);
		return cached.interaction;
	}
}

class AbortControllers {
	private _cache = new Collection<Snowflake, AbortController>();
	private maxAge = minutes(10);

	constructor() {
		setInterval(
			() => this._cache.sweep((_, messageId) => SnowflakeUtil.timestampFrom(messageId) - Date.now() > this.maxAge),
			this.maxAge,
		);
	}

	/**
	 * returns either the cached or a new AbortController
	 * @param messageId
	 */
	get(messageId: string) {
		return this._cache.ensure(messageId, () => new AbortController());
	}

	/**
	 * aborts either the cached AbortController or creates a new one and aborts it
	 * @param messageId
	 * @param reason
	 */
	abort(messageId: string, reason?: string) {
		return this.get(messageId).abort(
			// @ts-expect-error
			reason,
		);
	}
}

export class ChatBridgeManager {
	/**
	 * the client that instantiated the ChatBridgeArray
	 */
	client: LunarClient;
	/**
	 * minecraft command collection
	 */
	commands: BridgeCommandCollection;
	/**
	 * discord channel ids of all ChatBridge channels
	 */
	channelIds = new Set<Snowflake>();
	/**
	 * webhook ids of all ChatBridge channels
	 */
	webhookIds = new Set<Snowflake>();
	/**
	 * interaction cache
	 */
	interactionCache = new InteractionCache(this);
	/**
	 * individual chat bridges
	 */
	cache: ChatBridge[] = [];
	/**
	 * AbortSignals
	 */
	abortControllers = new AbortControllers();

	constructor(client: LunarClient, commandsURL: URL) {
		for (let i = 0; i < ChatBridgeManager._accounts.length; ++i) {
			this.cache.push(new ChatBridge(client, i));
		}

		this.client = client;
		this.commands = new BridgeCommandCollection(client, commandsURL);
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
	loadChannelIds() {
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
	 * @param index
	 */
	async connect(index?: number) {
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
	 * @param index
	 */
	disconnect(index?: undefined): ChatBridge[];
	disconnect(index: number): ChatBridge;
	disconnect(index?: number) {
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
	 * @param message
	 */
	async handleAnnouncementMessage(message: Message) {
		if (!message.content) return MessageUtil.react(message, UnicodeEmoji.Stop);

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
	 * @param message
	 */
	shouldIgnoreMessage(message: Pick<Message, 'id' | 'channelId' | 'webhookId'>) {
		return (
			!this.channelIds.has(message.channelId) ||
			(message.webhookId && this.webhookIds.has(message.webhookId)) ||
			!this.client.config.get('CHATBRIDGE_ENABLED')
		);
	}

	/**
	 * forwards the discord message if a chat bridge for that channel is found
	 * @param message
	 * @param options
	 */
	handleDiscordMessage(message: Message, options?: MessageForwardOptions) {
		if (this.shouldIgnoreMessage(message)) return; // not a chat bridge message or bridge disabled
		if (message.flags.any(MessageFlags.Ephemeral | MessageFlags.Loading)) return; // ignore ephemeral and loading (deferred, embeds missing, etc) messages
		if (MessageUtil.isNormalBotMessage(message)) return; // ignore non application command messages from the bot

		const _options = {
			signal: this.abortControllers.get(message.id).signal,
			...options,
		};

		if (_options.signal.aborted) return; // ignore deleted messages

		try {
			// a ChatBridge for the message's channel was found
			if (this.cache.reduce((acc, chatBridge) => chatBridge.handleDiscordMessage(message, _options) || acc, false)) {
				return;
			}

			// no ChatBridge for the message's channel found
			void MessageUtil.react(message, UnicodeEmoji.X);
		} catch (error) {
			logger.error(error, '[CHAT BRIDGES]: handleDiscordMessage');
			void MessageUtil.react(message, UnicodeEmoji.X);
		}
	}

	/**
	 * aborts the AbortController if the message was sent in a bridge channel
	 * @param message
	 */
	handleMessageDelete(message: Pick<Message, 'id' | 'channelId' | 'webhookId'>) {
		if (this.shouldIgnoreMessage(message)) return; // not a chat bridge message or bridge disabled

		this.abortControllers.abort(message.id, DELETED_MESSAGE_REASON);
	}
}
