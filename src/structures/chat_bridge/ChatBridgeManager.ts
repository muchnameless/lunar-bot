import { URL } from 'node:url';
import { once } from 'node:events';
import { env } from 'node:process';
import { stripIndents } from 'common-tags';
import { MessageFlags } from 'discord.js';
import { STOP_EMOJI, X_EMOJI } from '../../constants';
import { BridgeCommandCollection } from '../commands/BridgeCommandCollection';
import { MessageUtil } from '../../util';
import { logger } from '../../functions';
import { ChatBridge, ChatBridgeEvent } from './ChatBridge';
import { DiscordChatManager } from './managers/DiscordChatManager';
import type { ChatInputCommandInteraction, Message, Snowflake } from 'discord.js';
import type { MessageForwardOptions } from './ChatBridge';
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
	interactionCache = new Map<Snowflake, ChatInputCommandInteraction>();
	/**
	 * individual chat bridges
	 */
	cache: ChatBridge[] = [];

	constructor(client: LunarClient) {
		for (let i = 0; i < ChatBridgeManager._accounts.length; ++i) {
			this.cache.push(new ChatBridge(client, i));
		}

		this.client = client;
		this.commands = new BridgeCommandCollection(client, new URL('./commands', import.meta.url));
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
			const chatBridge = this.cache[index];

			chatBridge.connect();
			await once(chatBridge, ChatBridgeEvent.Ready);

			return this;
		}

		// all
		await Promise.all(
			this.cache.map((chatBridge) => {
				chatBridge.connect();
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
		if (!message.content) return MessageUtil.react(message, STOP_EMOJI);

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
			if (message.reactions.cache.get(X_EMOJI)?.me) {
				message.reactions.cache
					.get(X_EMOJI)!
					.users.remove(this.client.user!)
					.catch((error) => logger.error(error, '[HANDLE ANNOUNCEMENT MSG]'));
			}
		} else {
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
		if (message.flags.any(MessageFlags.Loading | MessageFlags.Ephemeral)) return; // ignore deferReply and ephemeral messages
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
			) {
				return; // message was sent by one of the ChatBridges's webhooks
			}

			// no ChatBridge for the message's channel found
			MessageUtil.react(message, X_EMOJI);
		} catch (error) {
			logger.error(error, '[CHAT BRIDGES]: handleDiscordMessage');
			MessageUtil.react(message, X_EMOJI);
		}
	}
}
