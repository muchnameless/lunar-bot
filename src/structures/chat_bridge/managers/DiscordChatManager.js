'use strict';

const { MessageEmbed, DiscordAPIError, MessageCollector, Permissions } = require('discord.js');
const ms = require('ms');
const { prefixByType, blockedWordsRegExp } = require('../constants/chatBridge');
const { X_EMOJI, MUTED } = require('../../../constants/emojiCharacters');
const { urlToImgurLink } = require('../../../functions/imgur');
const WebhookError = require('../../errors/WebhookError');
const ChatManager = require('./ChatManager');
const cache = require('../../../api/cache');
const logger = require('../../../functions/logger');


module.exports = class DiscordChatManager extends ChatManager {
	/**
	 * @param {import('../ChatBridge')} chatBridge
	 * @param {import('../../database/models/HypixelGuild').ChatBridgeChannel} param1
	 */
	constructor(chatBridge, { type, channelID }) {
		super(chatBridge);

		/**
		 * hypixel message type
		 */
		this.type = type;
		/**
		 * discord channel id
		 */
		this.channelID = channelID;
		/**
		 * hypixel chat prefix
		 */
		this.prefix = prefixByType[type];
		/**
		 * channel webhook
		 */
		this.webhook = null;
		/**
		 * chat bridge status
		 */
		this.ready = false;
	}

	/**
	 * player ign or member displayName or author username, ez escaped and *blocked* if blockedWordsRegExp check doesn't pass
	 * @param {import('../extensions/Message')} message
	 */
	static getPlayerName(message) {
		/** @type {string} */
		const name = message.webhookID
			? message.guild.members.cache.find(({ displayName }) => displayName === message.author.username)?.player?.ign ?? DiscordChatManager.escapeEz(message.author.username)
			: message.author.player?.ign ?? DiscordChatManager.escapeEz(message.member?.displayName ?? message.author.username);

		return blockedWordsRegExp.test(name)
			? '*blocked*'
			: name;
	}

	/**
	 * tries to upload all URLs to imgur, replacing all successfully uplaoded URLs with the imgur URLs
	 * @param {import('discord.js').MessageAttachment[]} attachments
	 * @returns {Promise<string[]>}
	 */
	static async _uploadAttachments(attachments) {
		return (await Promise.allSettled(attachments.map(attachment => (attachment.height !== null ? urlToImgurLink(attachment.url) : attachment.url)))).map(({ value }, index) => value ?? attachments[index].url);
	}

	/**
	 * DMs the message author with the content if they have not been DMed in the last 15 min
	 * @param {import('../../extensions/Message')} message
	 * @param {import('../../database/models/Player')} player
	 * @param {string} content
	 */
	static async _dmMuteInfo(message, player, content) {
		if (message.me) return;
		if (await cache.get(`chatbridge:mute:dm:${message.author.id}`)) return;

		try {
			await message.author.send(content);
			logger.info(`[DM MUTE INFO]: ${player?.logInfo ?? ''}: DMed muted user`);
		} catch (error) {
			logger.error(`[FORWARD DC TO MC]: ${player?.logInfo ?? ''}: error DMing muted user`, error);
		}

		cache.set(`chatbridge:mute:dm:${message.author.id}`, true, 15 * 60_000);
	}

	/**
	 * chat bridge channel
	 * @type {import('../../extensions/TextChannel')}
	 */
	get channel() {
		return this.client.channels.cache.get(this.channelID);
	}

	/**
	 * MinecraftChatManager
	 */
	get minecraft() {
		return this.chatBridge.minecraft;
	}

	/**
	 * initialize the discord chat manager
	 */
	async init() {
		return this._fetchOrCreateWebhook();
	}

	/**
	 * fetches or creates the webhook for the channel
	 */
	async _fetchOrCreateWebhook() {
		if (this.webhook) return this.ready = true;

		this.ready = false;

		if (!this.guild) return logger.warn(`[CHATBRIDGE]: chatBridge #${this.mcAccount}: no guild to fetch webhook`);

		try {
			const { channel } = this;

			if (!channel) {
				this.chatBridge.shouldRetryLinking = false;
				throw new WebhookError('unknown channel', channel, this.guild);
			}

			if (!channel.checkBotPermissions(Permissions.FLAGS.MANAGE_WEBHOOKS)) {
				this.chatBridge.shouldRetryLinking = false;
				throw new WebhookError('missing `MANAGE_WEBHOOKS`', channel, this.guild);
			}

			const webhooks = await channel.fetchWebhooks();

			if (webhooks.size) {
				this.webhook = webhooks.first();
			} else {
				this.webhook = await channel.createWebhook('chat bridge', { avatar: this.client.user.displayAvatarURL(), reason: 'no webhooks in chat bridge channel found' });

				this.client.log(new MessageEmbed()
					.setColor(this.client.config.get('EMBED_GREEN'))
					.setTitle(`${this.guild.name} Chat Bridge`)
					.setDescription(`**Webhook**: created in ${channel}`)
					.setTimestamp(),
				);
			}

			this.ready = true;

			logger.debug(`[CHATBRIDGE]: ${this.guild.name}: #${channel.name} webhook fetched and cached`);
		} catch (error) {
			this.client.log(new MessageEmbed()
				.setColor(this.client.config.get('EMBED_RED'))
				.setTitle(error.hypixelGuild ? `${error.hypixelGuild.name} Chat Bridge` : 'Chat Bridge')
				.setDescription(`**Error**: ${error.message}${error.channel ? ` in ${error.channel}` : ''}`)
				.setTimestamp(),
			);

			throw error;
		}
	}

	/**
	 * uncaches the webhook
	 */
	_uncacheWebhook() {
		this.webhook = null;
		this.ready = false;

		return this;
	}

	/**
	 * sends a message via the chatBridge webhook
	 * @param {string} content
	 * @param {import('discord.js').WebhookMessageOptions} options
	 * @returns {Promise<import('../../extensions/Message')>}
	 */
	async sendViaWebhook(content, options) {
		if (!this.chatBridge.enabled || !this.ready) return null;
		if (!content.length) return logger.warn(`[CHATBRIDGE]: ${this.logInfo}: prevented sending empty message`);

		await this.queue.wait();

		try {
			return await this.webhook.send(this.chatBridge.discord.parseContent(content), options);
		} catch (error) {
			logger.error(`[CHATBRIDGE WEBHOOK]: ${this.logInfo}`, error);

			if (error instanceof DiscordAPIError && error.method === 'get' && error.code === 0 && error.httpStatus === 404) {
				this._uncacheWebhook();
				this._fetchOrCreateWebhook();
			}

			throw error;
		} finally {
			this.queue.shift();
		}
	}

	/**
	 * sends a message via the bot in the chatBridge channel
	 * @param {string} content
	 * @param {object} [param1={}]
	 * @param {string} [param1.prefix='']
	 * @param {import('../HypixelMessage')} [param1.hypixelMessage]
	 * @param {import('discord.js').MessageOptions} [param1.options]
	 */
	async sendViaBot(content, { prefix = '', hypixelMessage, ...options } = {}) {
		if (!this.chatBridge.enabled) return null;

		await this.queue.wait();

		const discordMessage = await hypixelMessage?.discordMessage.catch(logger.error);

		try {
			return await this.channel.send(
				this.chatBridge.discord.parseContent(`${discordMessage || !hypixelMessage ? '' : `${hypixelMessage.member ?? `@${hypixelMessage.author.ign}`}, `}${prefix}${content}`),
				{
					reply: {
						messageReference: discordMessage,
						failIfNotExists: false,
					},
					...options,
				},
			);
		} finally {
			this.queue.shift();
		}
	}

	/**
	 * forwards a discord message to ingame guild chat, prettifying discord renders, if neither the player nor the whole guild chat is muted
	 * @param {import('../../extensions/Message')} message
	 * @param {import('../ChatBridge').MessageForwardOptions} [options={}]
	 */
	async forwardToMinecraft(message, { player = message.author.player, checkifNotFromBot = true } = {}) {
		if (!this.chatBridge.enabled) return;
		if (!this.minecraft.ready) return message.react(X_EMOJI);

		if (checkifNotFromBot) {
			if (message.me) return; // message was sent by the bot
			if (message.webhookID === this.webhook?.id) return; // message was sent by the ChatBridge's webhook
		}

		// check if player is muted
		if (player?.muted) {
			DiscordChatManager._dmMuteInfo(message, player, `you are currently muted for ${ms(player.chatBridgeMutedUntil - Date.now(), { long: true })}`);
			return message.react(MUTED);
		}

		// check if guild chat is muted
		if (this.guild.muted && !player?.isStaff) {
			DiscordChatManager._dmMuteInfo(message, player, `${this.guild.name}'s guild chat is currently muted for ${ms(this.guild.chatMutedUntil - Date.now(), { long: true })}`);
			return message.react(MUTED);
		}

		// check if the chatBridge bot is muted
		if (this.minecraft.bot.player?.muted) {
			DiscordChatManager._dmMuteInfo(message, player, `the bot is currently muted for ${ms(this.minecraft.bot.player.chatBridgeMutedUntil - Date.now(), { long: true })}`);
			return message.react(MUTED);
		}

		return this.minecraft.chat(
			[
				message.reference // @referencedMessageAuthor
					? await (async () => {
						try {
							/** @type {import('../extensions/Message')} */
							const referencedMessage = await message.fetchReference();
							return `@${DiscordChatManager.getPlayerName(referencedMessage)}`;
						} catch (error) {
							logger.error('[FORWARD DC TO MC]: error fetching reference', error);
							return null;
						}
					})()
					: null,
				message.content, // actual content
				message.attachments.size
					? await DiscordChatManager._uploadAttachments(message.attachments.array()) // links of attachments
					: null,
			].filter(Boolean).join(' '),
			{
				prefix: `${this.prefix} ${DiscordChatManager.getPlayerName(message)}: `,
				discordMessage: message,
			},
		);
	}

	/**
	 * collects chat messages from the bot
	 * @param {import('discord.js').CollectorFilter} filter
	 * @param {import('discord.js').MessageCollectorOptions} options
	 */
	createMessageCollector(filter, options = {}) {
		return new MessageCollector(this.channel, filter, options);
	}
};
