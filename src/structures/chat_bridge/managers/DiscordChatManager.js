'use strict';

const { MessageEmbed, DiscordAPIError, MessageCollector, Permissions, Formatters } = require('discord.js');
const { prefixByType } = require('../constants/chatBridge');
const { X_EMOJI, MUTED } = require('../../../constants/emojiCharacters');
const ChannelUtil = require('../../../util/ChannelUtil');
const UserUtil = require('../../../util/UserUtil');
const MessageUtil = require('../../../util/MessageUtil');
const InteractionUtil = require('../../../util/InteractionUtil');
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
	 * player ign or member displayName or author username, *blocked* if blockedWordsRegExp check doesn't pass
	 * @param {import('discord.js').Message} message
	 */
	static getPlayerName(message) {
		return this.formatAtMention(message.webhookId
			? UserUtil.getPlayer(message.guild.members.cache.find(({ displayName }) => displayName === message.author.username)?.user)?.ign ?? message.author.username
			: UserUtil.getPlayer(message.author)?.ign ?? message.member?.displayName ?? message.author.username,
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
	async #uploadAttachments(attachments) {
		if (!this.client.config.get('CHATBRIDGE_IMGUR_UPLOADER_ENABLED')) return attachments.map(({ url }) => url);

		return Promise.all(attachments.map(async ({ contentType, url }) => {
			// only images can be uploaded by URL https://apidocs.imgur.com/#c85c9dfc-7487-4de2-9ecd-66f727cf3139
			if (this.client.config.get('IMGUR_UPLOADER_CONTENT_TYPE').some(type => contentType.startsWith(type))) {
				try {
					return (await this.client.imgur.upload(url)).data.link;
				} catch (error) {
					logger.error('[UPLOAD ATTACHMENTS]', error);
					return url;
				}
			}

			return url; // no image (e.g. video)
		}));
	}

	/**
	 * DMs the message author with the content if they have not been DMed in the last hour
	 * @param {import('discord.js').Message} message
	 * @param {import('../../database/models/Player')} player
	 * @param {string} content
	 */
	static async #dmMuteInfo(message, player, content) {
		if (message.editable) return; // message was sent by the bot
		if (await cache.get(`chatbridge:muted:dm:${message.author.id}`)) return;

		UserUtil.sendDM(message.author, content);

		logger.info(`[DM MUTE INFO]: ${player?.logInfo ?? ''}: DMed muted user`);

		cache.set(`chatbridge:muted:dm:${message.author.id}`, true, 60 * 60_000); // prevent DMing again in the next hour
	}

	/**
	 * chat bridge channel
	 * @type {import('discord.js').TextChannel}
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
		return this.#fetchOrCreateWebhook();
	}

	/**
	 * fetches or creates the webhook for the channel
	 */
	async #fetchOrCreateWebhook() {
		if (this.webhook) return this.ready = true;

		this.ready = false;

		if (!this.hypixelGuild) return logger.warn(`[CHATBRIDGE]: chatBridge #${this.mcAccount}: no guild to fetch webhook`);

		try {
			const { channel } = this;

			if (!channel) {
				this.chatBridge.shouldRetryLinking = false;
				throw new WebhookError('unknown channel', channel, this.hypixelGuild);
			}

			if (!ChannelUtil.botPermissions(channel).has(Permissions.FLAGS.MANAGE_WEBHOOKS)) {
				this.chatBridge.shouldRetryLinking = false;
				throw new WebhookError('missing `MANAGE_WEBHOOKS`', channel, this.hypixelGuild);
			}

			const webhooks = await channel.fetchWebhooks();

			if (webhooks.size) {
				this.webhook = webhooks.first();
			} else {
				this.webhook = await channel.createWebhook('chat bridge', { avatar: this.client.user.displayAvatarURL(), reason: 'no webhooks in chat bridge channel found' });

				this.client.log(new MessageEmbed()
					.setColor(this.client.config.get('EMBED_GREEN'))
					.setTitle(`${this.hypixelGuild.name} Chat Bridge`)
					.setDescription(`${Formatters.bold('Webhook')}: created in ${channel}`)
					.setTimestamp(),
				);
			}

			this.ready = true;

			logger.debug(`[CHATBRIDGE]: ${this.hypixelGuild.name}: #${channel.name} webhook fetched and cached`);
		} catch (error) {
			this.client.log(new MessageEmbed()
				.setColor(this.client.config.get('EMBED_RED'))
				.setTitle(error.hypixelGuild ? `${error.hypixelGuild.name} Chat Bridge` : 'Chat Bridge')
				.setDescription(`${Formatters.bold('Error')}: ${error.message}${error.channel ? ` in ${error.channel}` : ''}`)
				.setTimestamp(),
			);

			throw error;
		}
	}

	/**
	 * uncaches the webhook
	 */
	#uncacheWebhook() {
		this.webhook = null;
		this.ready = false;

		return this;
	}

	/**
	 * sends a message via the chatBridge webhook
	 * @param {string | import('discord.js').WebhookMessageOptions} contentOrOptions
	 * @returns {Promise<import('discord.js').Message>}
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
				this.#uncacheWebhook();
				this.#fetchOrCreateWebhook();
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
			return await ChannelUtil.send(this.channel, {
				content: this.chatBridge.discord.parseContent(`${discordMessage || !hypixelMessage ? '' : `${hypixelMessage.member ?? `@${hypixelMessage.author}`}, `}${prefix}${content}`),
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
	 * @param {import('discord.js').Message} message
	 * @param {import('../ChatBridge').MessageForwardOptions} [options={}]
	 */
	async forwardToMinecraft(message, { player: playerInput, interaction, isEdit = false, checkIfNotFromBot = true } = {}) {
		if (!this.chatBridge.enabled) return;
		if (!this.minecraft.ready) return MessageUtil.react(message, X_EMOJI);

		if (checkIfNotFromBot) {
			if (message.editable) return; // message was sent by the bot
			if (message.webhookId === this.webhook?.id) return; // message was sent by the ChatBridge's webhook
		}

		/** @type {import('../../database/models/Player')} */
		const player = playerInput
			?? UserUtil.getPlayer(message.author) // cached player
			?? await this.client.players.fetch({ discordId: message.author.id }); // uncached player

		// check if player is muted
		if (player?.muted) {
			DiscordChatManager.#dmMuteInfo(message, player, `your mute expires ${Formatters.time(new Date(player.mutedTill), Formatters.TimestampStyles.RelativeTime)}`);
			return MessageUtil.react(message, MUTED);
		}

		// check if the player is auto muted
		if (player?.infractions >= this.client.config.get('CHATBRIDGE_AUTOMUTE_MAX_INFRACTIONS')) {
			DiscordChatManager.#dmMuteInfo(message, player, 'you are currently muted due to continues infractions');
			return MessageUtil.react(message, MUTED);
		}

		// check if guild chat is muted
		if (this.hypixelGuild.muted && !player?.isStaff) {
			DiscordChatManager.#dmMuteInfo(message, player, `${this.hypixelGuild.name}'s guild chat's mute expires ${Formatters.time(new Date(this.hypixelGuild.mutedTill), Formatters.TimestampStyles.RelativeTime)}`);
			return MessageUtil.react(message, MUTED);
		}

		// check if the chatBridge bot is muted
		if (this.minecraft.botPlayer?.muted) {
			DiscordChatManager.#dmMuteInfo(message, player, `the bot's mute expires ${Formatters.time(new Date(this.minecraft.botPlayer.mutedTill), Formatters.TimestampStyles.RelativeTime)}`);
			return MessageUtil.react(message, MUTED);
		}

		const content = [
			message.reference && !message.hasThread // @referencedMessageAuthor
				? await (async () => {
					try {
						/** @type {import('discord.js').Message} */
						const referencedMessage = await message.fetchReference();
						if (!message.author) return null;
						return `@${DiscordChatManager.getPlayerName(referencedMessage)}`;
					} catch (error) {
						logger.error('[FORWARD DC TO MC]: error fetching reference', error);
						return null;
					}
				})()
				: null,
			isEdit && !message.interaction && !message.content.endsWith('*') // actual content
				? `${message.content}*` // add a trailing '*' to indicate an edit if not already present
				: message.content,
			message.stickers.size // stickers
				? message.stickers.map(({ name }) => `:${name}:`).join(' ')
				: null,
			message.attachments.size // attachments
				? (await this.#uploadAttachments([ ...message.attachments.values() ])).join(' ') // links of attachments
				: null,
		].filter(Boolean).join(' ');

		if (!content) return MessageUtil.react(message, X_EMOJI);

		if (interaction) await this.minecraft.chat({
			content: `${this.client.config.get('PREFIXES')[0]}${InteractionUtil.logInfo(interaction)}`,
			prefix: `${this.prefix} ${DiscordChatManager.formatAtMention(player?.ign ?? interaction.member?.displayName ?? interaction.user.username)}: `,
		});

		return this.minecraft.chat({
			content,
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
