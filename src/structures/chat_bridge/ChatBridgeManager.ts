import { MessageFlags } from 'discord.js';
import { stripIndents } from 'common-tags';
import { URL } from 'node:url';
import { once } from 'node:events';
import { STOP_EMOJI, X_EMOJI } from '../../constants';
import { DiscordChatManager } from './managers/DiscordChatManager';
import { BridgeCommandCollection } from '../commands/BridgeCommandCollection';
import { ChatBridge, ChatBridgeEvents } from './ChatBridge';
import { MessageUtil } from '../../util';
import { logger } from '../../functions';
import type { CommandInteraction, Message, Snowflake } from 'discord.js';
import type { BroadcastOptions, MessageForwardOptions } from './ChatBridge';
import type { LunarClient } from '../LunarClient';

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
	 * discord channel IDs of all ChatBridge channels
	 */
	channelIds = new Set<Snowflake>();
	/**
	 * interaction cache
	 */
	interactionCache = new Map<Snowflake, CommandInteraction>();
	/**
	 * individual chat bridges
	 */
	cache: ChatBridge[] = [];

	constructor(client: LunarClient) {
		for (let i = 0; i < ChatBridgeManager.#accounts.length; ++i) {
			this.cache.push(new ChatBridge(client, i));
		}

		this.client = client;
		this.commands = new BridgeCommandCollection(client, new URL('./commands', import.meta.url));
	}

	/**
	 * mc accounts
	 */
	static get #accounts() {
		return process.env.MINECRAFT_ACCOUNT_TYPE!.split(/ +/).filter(Boolean);
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
		if (typeof index === 'number' && index >= 0 && index < ChatBridgeManager.#accounts.length) {
			const chatBridge = this.cache[index];

			chatBridge.connect();
			await once(chatBridge, ChatBridgeEvents.READY);

			return this;
		}

		// all
		await Promise.all(
			this.cache.map((chatBridge) => {
				chatBridge.connect();
				return once(chatBridge, ChatBridgeEvents.READY);
			}),
		);

		return this;
	}

	/**
	 * disconnects a single or all bridges
	 * @param index
	 */
	disconnect(): ChatBridge[];
	disconnect(index: number): ChatBridge;
	disconnect(index?: number) {
		// single
		if (typeof index === 'number') {
			return (
				this.cache[index]?.disconnect() ??
				(() => {
					throw new Error(`no chatBridge with index #${index}`);
				})()
			);
		}

		// all
		return this.cache.map((chatBridge) => chatBridge.disconnect());
	}

	/**
	 * send a message via all chatBridges both to discord and the in game guild chat, parsing both
	 * @param contentOrOptions
	 */
	broadcast(contentOrOptions: string | BroadcastOptions) {
		return Promise.all(this.cache.map((chatBridge) => chatBridge.broadcast(contentOrOptions)));
	}

	/**
	 * forwards announcement messages to all chatBridges (via broadcast)
	 * @param message
	 */
	async handleAnnouncementMessage(message: Message) {
		if (!this.cache.length) return MessageUtil.react(message, X_EMOJI);
		if (!message.content) return MessageUtil.react(message, STOP_EMOJI);

		try {
			const result = await this.broadcast({
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

			if (result.every(([minecraft, discord]) => minecraft && (Array.isArray(discord) ? discord.length : discord))) {
				if (message.reactions.cache.get(X_EMOJI)?.me) {
					message.reactions.cache
						.get(X_EMOJI)!
						.users.remove(this.client.user!)
						.catch((error) => logger.error(error, '[HANDLE ANNOUNCEMENT MSG]'));
				}
			} else {
				MessageUtil.react(message, X_EMOJI);
			}
		} catch (error) {
			logger.error(error, '[HANDLE ANNOUNCEMENT MSG]');
			MessageUtil.react(message, X_EMOJI);
		}
	}

	/**
	 * forwards the discord message if a chat bridge for that channel is found
	 * @param message
	 * @param options
	 */
	handleDiscordMessage(message: Message, options?: MessageForwardOptions) {
		if (!this.channelIds.has(message.channelId) || !this.client.config.get('CHATBRIDGE_ENABLED')) return; // not a chat bridge message or bridge disabled
		if (message.flags.any([MessageFlags.FLAGS.LOADING, MessageFlags.FLAGS.EPHEMERAL])) return; // ignore deferReply and ephemeral messages
		if (MessageUtil.isNormalBotMessage(message)) return; // ignore non application command messages from the bot

		try {
			// a ChatBridge for the message's channel was found
			if (this.cache.reduce((acc, chatBridge) => chatBridge.handleDiscordMessage(message, options) || acc, false)) {
				return;
			}

			// check if the message was sent from the bot, don't react with X_EMOJI in this case
			if (
				message.webhookId &&
				this.cache.reduce(
					(acc, chatBridge) =>
						acc || message.webhookId === chatBridge.discord.channelsByIds.get(message.channelId)?.webhook?.id,
					false,
				)
			)
				return; // message was sent by one of the ChatBridges's webhook

			// no ChatBridge for the message's channel found
			MessageUtil.react(message, X_EMOJI);
		} catch (error) {
			logger.error(error, '[CHAT BRIDGES]: handleDiscordMessage');
			MessageUtil.react(message, X_EMOJI);
		}
	}
}
