'use strict';

const { MessageEmbed, DiscordAPIError, MessageCollector } = require('discord.js');
const WebhookError = require('../../errors/WebhookError');
const ChatManager = require('./ChatManager');
const logger = require('../../../functions/logger');


module.exports = class DiscordChatManager extends ChatManager {
	/**
	 * @param {import('../ChatBridge')} chatBridge
	 * @param {import('../../database/models/HypixelGuild').ChatBridgeChannel} param1
	 */
	constructor(chatBridge, { type, channelID, prefix }) {
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
		this.prefix = prefix;
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
	 * chat bridge channel
	 * @type {import('../../extensions/TextChannel')}
	 */
	get channel() {
		return this.client.channels.cache.get(this.channelID);
	}

	/**
	 * initialize the discord chat manager
	 */
	async init() {
		return this.fetchOrCreateWebhook();
	}

	async fetchOrCreateWebhook() {
		if (this.webhook) return this.ready = true;

		this.ready = false;

		if (!this.guild) return logger.warn(`[CHATBRIDGE]: chatBridge #${this.mcAccount}: no guild to fetch webhook`);

		try {
			const { channel } = this;

			if (!channel) {
				this.chatBridge.shouldRetryLinking = false;
				throw new WebhookError('unknown channel', channel, this.guild);
			}

			if (!channel.checkBotPermissions('MANAGE_WEBHOOKS')) {
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
				.setDescription(`**Error**: ${error.message}${error.channel ? `in ${error.channel}` : ''}`)
				.setTimestamp(),
			);

			throw error;
		}
	}

	/**
	 * uncaches the webhook
	 */
	uncacheWebhook() {
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
			logger.error(`[CHATBRIDGE WEBHOOK]: ${this.logInfo}: ${error}`);

			if (error instanceof DiscordAPIError && error.method === 'get' && error.code === 0 && error.httpStatus === 404) {
				this.uncacheWebhook();
				this.fetchOrCreateWebhook();
			}

			throw error;
		} finally {
			this.queue.shift();
		}
	}

	/**
	 * sends a message via the bot in the chatBridge channel
	 * @param {string} content
	 * @param {import('discord.js').MessageOptions} options
	 */
	async sendViaBot(content, options) {
		if (!this.chatBridge.enabled) return null;

		await this.queue.wait();

		try {
			return await this.channel.send(this.chatBridge.discord.parseContent(content), options);
		} finally {
			this.queue.shift();
		}
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
