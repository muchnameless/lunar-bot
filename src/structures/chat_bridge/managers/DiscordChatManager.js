'use strict';

const { MessageEmbed, DiscordAPIError, MessageCollector, Permissions, Formatters: { TimestampStyles } } = require('discord.js');
const FormData = require('form-data');
const fetch = require('node-fetch');
const { prefixByType } = require('../constants/chatBridge');
const { X_EMOJI, MUTED } = require('../../../constants/emojiCharacters');
const { timestampToDateMarkdown } = require('../../../functions/util');
const WebhookError = require('../../errors/WebhookError');
const ChatManager = require('./ChatManager');
const cache = require('../../../api/cache');
const logger = require('../../../functions/logger');


module.exports = class DiscordChatManager extends ChatManager {
	/**
	 * @param {import('../ChatBridge')} chatBridge
	 * @param {import('../../database/models/HypixelGuild').ChatBridgeChannel} param1
	 */
	constructor(chatBridge, { type, channelId }) {
		super(chatBridge);

		/**
		 * hypixel message type
		 */
		this.type = type;
		/**
		 * discord channel id
		 */
		this.channelId = channelId;
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
	 * @param {import('../../extensions/Message')} message
	 */
	static getPlayerName(message) {
		return this.formatAtMention(message.webhookId
			? message.guild.members.cache.find(({ displayName }) => displayName === message.author.username)?.player?.ign ?? DiscordChatManager.escapeEz(message.author.username)
			: message.author.player?.ign ?? DiscordChatManager.escapeEz(message.member?.displayName ?? message.author.username),
		);
	}

	/**
	 * returns @name if the name passes the blockedWordsRegExp
	 * @param {string} name
	 */
	static formatAtMention(name) {
		return this.BLOCKED_WORDS_REGEXP.test(name)
			? '*blocked*'
			: name;
	}

	/**
	 * tries to upload all URLs to imgur, replacing all successfully uplaoded URLs with the imgur URLs
	 * @param {import('discord.js').MessageAttachment[]} attachments
	 * @returns {Promise<string[]>}
	 */
	static async _uploadAttachments(attachments) {
		return (await Promise.allSettled(attachments.map(attachment => (attachment.height !== null ? this.urlToImgurLink(attachment.url) : attachment.url))))
			.map(({ value }, index) => value ?? attachments[index].url);
	}

	/**
	 * @param {string} url
	 * @returns {Promise<string>}
	 */
	static async urlToImgurLink(url) {
		const form = new FormData();

		form.append('image', url);
		form.append('type', 'url');

		const res = await fetch('https://api.imgur.com/3/upload', {
			method: 'POST',
			body: form,
			headers: {
				Authorization: `Client-ID ${process.env.IMGUR_CLIENT_ID}`,
			},
		});

		if (res.status !== 200) {
			logger.error('IMGUR', res);
			throw new Error('error uploading to imgur');
		}

		return (await res.json()).data.link;
	}

	/**
	 * DMs the message author with the content if they have not been DMed in the last hour
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

		cache.set(`chatbridge:mute:dm:${message.author.id}`, true, 60 * 60_000); // prevent DMing again in the next hour
	}

	/**
	 * chat bridge channel
	 * @type {import('../../extensions/TextChannel')}
	 */
	get channel() {
		return this.client.channels.cache.get(this.channelId);
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

			if (!channel.botPermissions.has(Permissions.FLAGS.MANAGE_WEBHOOKS)) {
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
	 * @param {string | import('discord.js').WebhookMessageOptions} contentOrOptions
	 * @returns {Promise<import('../../extensions/Message')>}
	 */
	async sendViaWebhook(contentOrOptions) {
		if (!this.chatBridge.enabled || !this.ready) return null;

		const { content, ...options } = typeof contentOrOptions === 'string'
			? { content: contentOrOptions }
			: contentOrOptions;

		if (!content.length) return logger.warn(`[CHATBRIDGE]: ${this.logInfo}: prevented sending empty message`);

		await this.queue.wait();

		try {
			return await this.webhook.send({
				content: this.chatBridge.discord.parseContent(content),
				...options,
			});
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
	 * @param {string | { prefix: string, hypixelMessage: import('../HypixelMessage'), options: import('discord.js').MessageOptions }} contentOrOptions
	 */
	async sendViaBot(contentOrOptions) {
		if (!this.chatBridge.enabled) return null;

		const { content, prefix = '', hypixelMessage, ...options } = typeof contentOrOptions === 'string'
			? { content: contentOrOptions }
			: contentOrOptions;

		await this.queue.wait();

		const discordMessage = await hypixelMessage?.discordMessage.catch(logger.error);

		try {
			return await this.channel.send({
				content: this.chatBridge.discord.parseContent(`${discordMessage || !hypixelMessage ? '' : `${hypixelMessage.member ?? `@${hypixelMessage.author.ign}`}, `}${prefix}${content}`),
				reply: {
					messageReference: discordMessage,
				},
				...options,
			});
		} finally {
			this.queue.shift();
		}
	}

	/**
	 * forwards a discord message to in game guild chat, prettifying discord markdown, if neither the player nor the whole guild chat is muted
	 * @param {import('../../extensions/Message')} message
	 * @param {import('../ChatBridge').MessageForwardOptions} [options={}]
	 */
	async forwardToMinecraft(message, { player: playerInput, interaction, isEdit = false, checkIfNotFromBot = true } = {}) {
		if (!this.chatBridge.enabled) return;
		if (!this.minecraft.ready) return message.react(X_EMOJI);

		if (checkIfNotFromBot) {
			if (message.me) return; // message was sent by the bot
			if (message.webhookId === this.webhook?.id) return; // message was sent by the ChatBridge's webhook
		}

		/** @type {import('../../database/models/Player')} */
		const player = playerInput
			?? message.author.player // cached player
			?? await this.client.players.model.findOne({ where: { discordId: message.author.id } }); // uncached player

		// check if player is muted
		if (player?.muted) {
			DiscordChatManager._dmMuteInfo(message, player, `your mute expires ${timestampToDateMarkdown(player.mutedTill, TimestampStyles.RelativeTime)}`);
			return message.react(MUTED);
		}

		// check if the player is auto muted
		if (player?.infractions >= this.client.config.get('CHATBRIDGE_AUTOMUTE_MAX_INFRACTIONS')) {
			DiscordChatManager._dmMuteInfo(message, player, 'you are currently muted due to continues infractions');
			return message.react(MUTED);
		}

		// check if guild chat is muted
		if (this.guild.muted && !player?.isStaff) {
			DiscordChatManager._dmMuteInfo(message, player, `${this.guild.name}'s guild chat's mute expires ${timestampToDateMarkdown(this.guild.mutedTill, TimestampStyles.RelativeTime)}`);
			return message.react(MUTED);
		}

		// check if the chatBridge bot is muted
		if (this.minecraft.bot.player?.muted) {
			DiscordChatManager._dmMuteInfo(message, player, `the bot's mute expires ${timestampToDateMarkdown(this.minecraft.bot.player.mutedTill, TimestampStyles.RelativeTime)}`);
			return message.react(MUTED);
		}

		const content = [
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
			message.stickers.size // stickers
				? message.stickers.map(({ name }) => `:${name}:`).join(' ')
				: null,
			message.attachments.size // attachments
				? (await DiscordChatManager._uploadAttachments([ ...message.attachments.values() ])).join(' ') // links of attachments
				: null,
		].filter(Boolean).join(' ');

		if (!content) return message.react(X_EMOJI);

		if (interaction) await this.minecraft.chat({
			content: `${this.client.config.get('PREFIX')}${interaction.logInfo ?? ''}`,
			prefix: `${this.prefix} ${DiscordChatManager.formatAtMention(player?.ign ?? DiscordChatManager.escapeEz(interaction.member?.displayName ?? interaction.user.username))}: `,
		});

		return this.minecraft.chat({
			content: isEdit && !content.endsWith('*')
				? `${content}*` // add a leading * to indicate an edit if not already present
				: content,
			prefix: `${this.prefix} ${interaction ? '' : `${DiscordChatManager.getPlayerName(message)}: `}`,
			discordMessage: message,
		});
	}

	/**
	 * collects chat messages from the bot
	 * @param {import('discord.js').MessageCollectorOptions} options
	 */
	createMessageCollector(options = {}) {
		return new MessageCollector(this.channel, options);
	}
};
