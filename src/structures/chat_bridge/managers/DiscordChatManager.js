import { MessageEmbed, DiscordAPIError, MessageCollector, Permissions, Formatters } from 'discord.js';
import { PREFIX_BY_TYPE, DISCORD_CDN_URL_REGEXP } from '../constants/index.js';
import { X_EMOJI, MUTED_EMOJI, STOP_EMOJI } from '../../../constants/index.js';
import { ChannelUtil, InteractionUtil, MessageUtil, UserUtil } from '../../../util/index.js';
import { WebhookError } from '../../errors/WebhookError.js';
import { ChatManager } from './ChatManager.js';
import { cache } from '../../../api/cache.js';
import { imgur } from '../../../api/imgur.js';
import { logger } from '../../../functions/index.js';


export class DiscordChatManager extends ChatManager {
	/**
	 * @param {import('../ChatBridge').ChatBridge} chatBridge
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
		 * @type {string}
		 */
		this.prefix = PREFIX_BY_TYPE[type];
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
	 * player ign or member displayName or author username, *blocked* if BLOCKED_WORDS_REGEXP check doesn't pass
	 * @param {import('discord.js').Message} message
	 */
	static getPlayerName(message) {
		return this.formatAtMention(
			MessageUtil.isNormalWebhookMessage(message)
				? UserUtil.getPlayer(message.guild.members.cache.find(({ displayName }) => displayName === message.author.username)?.user)?.ign ?? message.author.username
				: UserUtil.getPlayer(message.author)?.ign ?? message.member?.displayName ?? message.author.username,
		);
	}

	/**
	 * returns @name if the name passes the BLOCKED_WORDS_REGEXP
	 * @param {string} name
	 */
	static formatAtMention(name) {
		return this.BLOCKED_WORDS_REGEXP.test(name)
			? '*blocked name*'
			: name;
	}

	/**
	 * tries to upload all URLs to imgur, replacing all successfully uplaoded URLs with the imgur URLs
	 * @param {import('discord.js').Collection<import('discord.js').Snowflake, import('discord.js').MessageAttachment>} attachments
	 */
	async #uploadAttachments(attachments) {
		if (!this.client.config.get('CHATBRIDGE_IMGUR_UPLOADER_ENABLED')) return attachments.map(({ url }) => url);

		const ret = [];

		let hasError = false;

		for (const { contentType, url, size } of attachments.values()) {
			// only images can be uploaded by URL https://apidocs.imgur.com/#c85c9dfc-7487-4de2-9ecd-66f727cf3139
			if (!hasError && this.client.config.get('IMGUR_UPLOADER_CONTENT_TYPE').some(type => contentType.startsWith(type)) && size <= 1e7) {
				try {
					ret.push((await imgur.upload(url)).data.link);
				} catch (error) {
					logger.error('[UPLOAD ATTACHMENTS]', error);
					ret.push(url);
					hasError = true;
				}

				continue;
			}

			ret.push(url); // no image (e.g. video)
		}

		return ret;
	}

	/**
	 * DMs the message author with the content if they have not been DMed in the last hour
	 * @param {import('discord.js').Message} message
	 * @param {import('../../database/models/Player').Player} player
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
	 * @param {string | { prefix: string, hypixelMessage: import('../HypixelMessage').HypixelMessage, options: import('discord.js').MessageOptions }} contentOrOptions
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
	async forwardToMinecraft(message, { player: playerInput, isEdit = false } = {}) {
		if (message.webhookId === this.webhook?.id) return; // message was sent by the ChatBridge's webhook
		if (!this.chatBridge.enabled || !this.minecraft.ready) return MessageUtil.react(message, X_EMOJI);

		/** @type {import('../../database/models/Player').Player} */
		const player = playerInput
			?? UserUtil.getPlayer(message.interaction?.user ?? message.author) // cached player
			?? await this.client.players.fetch({ discordId: message.interaction?.user.id ?? message.author.id }); // uncached player

		// check if player is muted
		if (player?.muted) {
			DiscordChatManager.#dmMuteInfo(message, player, `your mute expires ${Formatters.time(new Date(player.mutedTill), Formatters.TimestampStyles.RelativeTime)}`);
			return MessageUtil.react(message, MUTED_EMOJI);
		}

		// check if the player is auto muted
		if (player?.infractions >= this.client.config.get('CHATBRIDGE_AUTOMUTE_MAX_INFRACTIONS')) {
			DiscordChatManager.#dmMuteInfo(message, player, 'you are currently muted due to continues infractions');
			return MessageUtil.react(message, MUTED_EMOJI);
		}

		// check if guild chat is muted
		if (this.hypixelGuild.muted && !player?.isStaff) {
			DiscordChatManager.#dmMuteInfo(message, player, `${this.hypixelGuild.name}'s guild chat's mute expires ${Formatters.time(new Date(this.hypixelGuild.mutedTill), Formatters.TimestampStyles.RelativeTime)}`);
			return MessageUtil.react(message, MUTED_EMOJI);
		}

		// check if the chatBridge bot is muted
		if (this.minecraft.botPlayer?.muted) {
			DiscordChatManager.#dmMuteInfo(message, player, `the bot's mute expires ${Formatters.time(new Date(this.minecraft.botPlayer.mutedTill), Formatters.TimestampStyles.RelativeTime)}`);
			return MessageUtil.react(message, MUTED_EMOJI);
		}

		// build content
		const contentParts = [];

		// @referencedMessageAuthor if normal reply
		if (MessageUtil.isNormalReplyMessage(message)) {
			try {
				const referencedMessage = await message.fetchReference();

				// author found and author is not already pinged
				if (referencedMessage.author && !new RegExp(`<@!?${referencedMessage.author.id}>`).test(message.content)) {
					contentParts.push(`@${DiscordChatManager.getPlayerName(referencedMessage)}`);
				}
			} catch (error) {
				logger.error('[FORWARD DC TO MC]: error fetching reference', error);
			}
		}

		// actual content
		let messageContent = isEdit && !message.interaction && message.content && !message.content.endsWith('*')
			? `${message.content}*` // add a trailing '*' to indicate an edit if not already present
			: message.content;

		if (messageContent) {
			// parse discord attachment links and replace with imgur uploaded link
			if (this.client.config.get('CHATBRIDGE_IMGUR_UPLOADER_ENABLED')) {
				let offset = 0;

				for (const match of messageContent.matchAll(DISCORD_CDN_URL_REGEXP)) {
					const [ URL ] = match;
					const [ [ START, END ] ] = match.indices;

					try {
						const IMGUR_URL = (await imgur.upload(URL)).data.link;

						messageContent = `${messageContent.slice(0, START - offset)}${IMGUR_URL}${messageContent.slice(END - offset)}`; // replace discord with imgur link
						offset += URL.length - IMGUR_URL.length; // since indices are relative to the original string
					} catch (error) {
						logger.error(error);
						break;
					}
				}
			}

			contentParts.push(messageContent);
		}

		// stickers
		if (message.stickers.size) contentParts.push(...message.stickers.map(({ name }) => `:${name}:`));

		// links of attachments
		if (message.attachments.size) contentParts.push(...(await this.#uploadAttachments(message.attachments)));

		// empty message (e.g. only embeds)
		if (!contentParts.length) return MessageUtil.react(message, STOP_EMOJI);

		// send interaction "command" for initial application command reply
		if (message.type === 'APPLICATION_COMMAND' && !message.editedTimestamp) {
			const interaction = this.client.chatBridges.interactionCache.get(message.interaction.id);

			this.minecraft.chat({
				content: `/${interaction ? InteractionUtil.getCommand(interaction) : message.interaction.commandName}`,
				prefix: `${this.prefix} ${DiscordChatManager.formatAtMention(player?.ign ?? message.interaction.user.username)}: `,
			});
		}

		// send content
		return this.minecraft.chat({
			content: contentParts.join(' '),
			prefix: `${this.prefix} ${message.editable ? '' : `${DiscordChatManager.getPlayerName(message)}: `}`,
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
}
