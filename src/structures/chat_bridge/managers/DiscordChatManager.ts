import {
	bold,
	DiscordAPIError,
	EmbedBuilder,
	MessageCollector,
	PermissionFlagsBits,
	time,
	TimestampStyles,
} from 'discord.js';
import { PREFIX_BY_TYPE, DISCORD_CDN_URL_REGEXP } from '../constants';
import { UnicodeEmoji, WEBHOOKS_MAX_PER_CHANNEL } from '../../../constants';
import { ChannelUtil, MessageUtil, UserUtil } from '../../../util';
import { WebhookError } from '../../errors/WebhookError';
import { imgur } from '../../../api';
import { asyncReplace } from '../../../functions';
import { TimeoutAsyncQueue } from '../../TimeoutAsyncQueue';
import { logger } from '../../../logger';
import { ChatManager } from './ChatManager';
import type {
	Attachment,
	Collection,
	Message,
	MessageCollectorOptions,
	MessageOptions,
	Snowflake,
	TextChannel,
	User,
	Webhook,
	WebhookMessageOptions,
} from 'discord.js';
import type { ChatBridge, MessageForwardOptions } from '../ChatBridge';
import type { ChatBridgeChannel } from '../../database/models/HypixelGuild';
import type { HypixelMessage } from '../HypixelMessage';

interface SendViaBotOptions extends MessageOptions {
	content: string;
	hypixelMessage?: HypixelMessage | null;
	fromMinecraft?: boolean;
}

interface SendViaWebhookOptions extends WebhookMessageOptions {
	queuePromise?: Promise<void>;
}

export class DiscordChatManager extends ChatManager {
	/**
	 * webhook fetching/creating & caching
	 */
	private _fetchOrCreateWebhookPromise: Promise<this> | null = null;
	/**
	 * chat queue
	 */
	// @ts-expect-error
	override queue = new TimeoutAsyncQueue();
	/**
	 * hypixel message type
	 */
	type: keyof typeof PREFIX_BY_TYPE;
	/**
	 * discord channel id
	 */
	channelId: Snowflake;
	/**
	 * hypixel chat prefix
	 */
	prefix: string;
	/**
	 * channel webhook
	 */
	webhook: Webhook | null = null;
	/**
	 * chat bridge status
	 */
	ready = false;

	/**
	 * @param chatBridge
	 * @param channel
	 */
	constructor(chatBridge: ChatBridge, { type, channelId }: ChatBridgeChannel) {
		super(chatBridge);

		this.type = type;
		this.channelId = channelId;
		this.prefix = PREFIX_BY_TYPE[type];
	}

	/**
	 * player ign or member displayName or author username, *blocked* if BLOCKED_WORDS_REGEXP check doesn't pass
	 * @param message
	 */
	static getPlayerName(message: Message) {
		return this.formatAtMention(
			MessageUtil.isNormalWebhookMessage(message)
				? UserUtil.getPlayer(
						message.guild?.members.cache.find(({ displayName }) => displayName === message.author.username)?.user,
				  )?.ign ?? message.author.username
				: UserUtil.getPlayer(message.author)?.ign ?? message.member?.displayName ?? message.author.username,
		);
	}

	/**
	 * returns @name if the name passes the BLOCKED_WORDS_REGEXP
	 * @param name
	 */
	static formatAtMention(name: string) {
		return this.BLOCKED_WORDS_REGEXP.test(name) ? '*blocked name*' : name;
	}

	/**
	 * tries to upload all image attachments to imgur, replacing all successfully uploaded URLs with the imgur URLs
	 * @param attachments
	 */
	private async _uploadAttachments(attachments: Collection<Snowflake, Attachment>) {
		if (!this.client.config.get('IMGUR_UPLOADER_ENABLED')) return attachments.map(({ url }) => url);

		const urls: string[] = [];

		let hasError = false;

		for (const { contentType, url, size } of attachments.values()) {
			// only images can be uploaded by URL https://apidocs.imgur.com/#c85c9dfc-7487-4de2-9ecd-66f727cf3139
			if (
				!hasError &&
				this.client.config.get('IMGUR_UPLOADER_CONTENT_TYPE').some((type) => contentType?.startsWith(type)) &&
				size <= 1e7
			) {
				try {
					urls.push((await imgur.upload(url)).data.link);
				} catch (error) {
					logger.error(error, '[UPLOAD ATTACHMENTS]');
					urls.push(url);
					hasError = true;
				}

				continue;
			}

			urls.push(url); // no image (e.g. video)
		}

		return urls;
	}

	/**
	 * DMs the message author with the content if they have not been DMed in the last hour
	 * @param user
	 * @param content
	 */
	static _dmMuteInfo(user: User, content: string) {
		return UserUtil.sendDM(user, {
			content,
			redisKey: `dm:${user.id}:chatbridge:muted`,
		});
	}

	/**
	 * chat bridge channel
	 */
	get channel() {
		return this.client.channels.cache.get(this.channelId) as TextChannel;
	}

	/**
	 * MinecraftChatManager
	 */
	get minecraft() {
		return this.chatBridge.minecraft;
	}

	/**
	 * asserts that the webhook is present
	 */
	isReady(): this is this & { webhook: Webhook } {
		return this.ready;
	}

	/**
	 * initialise the discord chat manager
	 */
	init() {
		return this._fetchOrCreateWebhook();
	}

	/**
	 * fetches or creates the webhook for the channel
	 */
	private async _fetchOrCreateWebhook() {
		if (this.webhook) {
			this.ready = true;
			return this;
		}

		if (this._fetchOrCreateWebhookPromise) return this._fetchOrCreateWebhookPromise;

		try {
			return await (this._fetchOrCreateWebhookPromise = this.__fetchOrCreateWebhook());
		} finally {
			this._fetchOrCreateWebhookPromise = null;
		}
	}
	/**
	 * should only ever be called from within _fetchOrCreateWebhook
	 * @internal
	 */
	private async __fetchOrCreateWebhook() {
		this.ready = false;

		if (!this.hypixelGuild) {
			logger.warn(`[CHATBRIDGE]: chatBridge #${this.mcAccount}: no guild to fetch webhook`);
			return this;
		}

		try {
			const { channel } = this;

			if (!channel) {
				throw new WebhookError('unknown channel', channel, this.hypixelGuild);
			}

			if (!ChannelUtil.botPermissions(channel).has(PermissionFlagsBits.ManageWebhooks)) {
				throw new WebhookError('missing `MANAGE_WEBHOOKS`', channel, this.hypixelGuild);
			}

			const webhooks = await channel.fetchWebhooks();

			this.webhook =
				webhooks.find((webhook) => webhook.isIncoming() && webhook.owner?.id === this.client.user!.id) ?? null;

			if (!this.webhook) {
				if (webhooks.size >= WEBHOOKS_MAX_PER_CHANNEL) {
					throw new WebhookError('cannot create more webhooks', channel, this.hypixelGuild);
				}

				this.webhook = await channel.createWebhook({
					name: `${this.hypixelGuild} Chat Bridge`,
					avatar: (channel.guild?.members.me ?? this.client.user!).displayAvatarURL(),
					reason: 'no Webhooks in Chat Bridge Channel found',
				});

				void this.client.log(
					new EmbedBuilder()
						.setColor(this.client.config.get('EMBED_GREEN'))
						.setTitle(`${this.hypixelGuild} Chat Bridge`)
						.setDescription(`${bold('Webhook')}: created in ${channel}`)
						.setTimestamp(),
				);
			}

			this.ready = true;

			logger.debug(`[CHATBRIDGE]: ${this.hypixelGuild}: #${channel.name} webhook fetched and cached`);
			return this;
		} catch (error) {
			if (error instanceof WebhookError) {
				this.chatBridge.shouldRetryLinking = false;

				void this.client.log(
					new EmbedBuilder()
						.setColor(this.client.config.get('EMBED_RED'))
						.setTitle(`${error.hypixelGuild} Chat Bridge`)
						.setDescription(`${bold('Error')}: ${error.message}${error.channel ? ` in ${error.channel}` : ''}`)
						.setTimestamp(),
				);
			}

			throw error;
		}
	}

	/**
	 * uncaches the webhook
	 */
	private _uncacheWebhook() {
		this.webhook = null;
		this.ready = false;

		return this;
	}

	/**
	 * sends a message via the chatBridge webhook
	 * @param options
	 */
	async sendViaWebhook({ queuePromise, ...options }: SendViaWebhookOptions) {
		// chat bridge disabled
		if (!this.chatBridge.isEnabled()) {
			if (queuePromise) {
				await queuePromise;
				this.queue.shift();
			}
			throw new Error(`[SEND VIA WEBHOOK]: ${this.logInfo}: not enabled`);
		}

		// no content
		if (!options.content) {
			if (queuePromise) {
				await queuePromise;
				this.queue.shift();
			}
			throw new Error(`[SEND VIA WEBHOOK]: ${this.logInfo}: no content`);
		}

		// async queue
		await (queuePromise ?? this.queue.wait());

		try {
			return await this._sendViaWebhook(options);
		} finally {
			this.queue.shift();
		}
	}
	/**
	 * should only ever be called from within sendViaWebhook
	 * @param options
	 * @internal
	 */
	async _sendViaWebhook(options: WebhookMessageOptions): Promise<Message> {
		try {
			// fetch / create webhook if non existent
			if (!this.isReady()) {
				await this._fetchOrCreateWebhook();

				if (!this.isReady()) throw new Error(`[SEND VIA WEBHOOK]: ${this.logInfo}: not ready`);
			}

			// API request
			return (await this.webhook.send(options)) as Message;
		} catch (error) {
			// webhook deleted
			if (error instanceof DiscordAPIError && error.status === 404) {
				logger.error(error, `[SEND VIA WEBHOOK]: ${this.logInfo}: webhook deleted -> recreating & resending`);

				// try to obtain another webhook
				this._uncacheWebhook();
				await this._fetchOrCreateWebhook();

				// resend
				return this._sendViaWebhook(options);
			}

			throw error;
		}
	}

	/**
	 * sends a message via the bot in the chatBridge channel
	 * @param options
	 */
	async sendViaBot({ hypixelMessage, content, fromMinecraft, ...options }: SendViaBotOptions) {
		if (!this.chatBridge.isEnabled()) return null;

		const queuePromise = this.queue.wait();

		let discordMessage: Message | null | undefined;
		try {
			discordMessage = await hypixelMessage?.discordMessage;
		} catch (error) {
			logger.error(error);
		}

		const _options: SendViaBotOptions = {
			content: await this.chatBridge.discord.parseContent(
				`${
					discordMessage || !hypixelMessage ? '' : `${hypixelMessage.member ?? `@${hypixelMessage.author}`}, `
				}${content}`,
				fromMinecraft,
			),
			reply: {
				messageReference: discordMessage as Message,
			},
			...options,
		};

		await queuePromise;

		try {
			return await ChannelUtil.send(this.channel, _options);
		} finally {
			this.queue.shift();
		}
	}

	/**
	 * forwards a discord message to in-game guild chat, prettifying discord markdown, if neither the player nor the whole guild chat is muted
	 * @param message
	 * @param options
	 */
	async forwardToMinecraft(message: Message, { player: playerInput, isEdit = false }: MessageForwardOptions = {}) {
		if (message.webhookId === this.webhook?.id) return; // message was sent by the ChatBridge's webhook
		if (!this.chatBridge.isEnabled() || !this.minecraft.isReady()) return MessageUtil.react(message, UnicodeEmoji.X);

		const messageInteraction =
			message.interaction ??
			// followUp to an interaction
			(message.reference && message.channel.messages.cache.get(message.reference.messageId!)?.interaction);
		const player =
			playerInput ??
			UserUtil.getPlayer(messageInteraction?.user ?? message.author) ?? // cached player
			(await this.client.players.fetch({ discordId: messageInteraction?.user.id ?? message.author.id })); // uncached player

		// check if player is muted
		if (this.hypixelGuild!.checkMute(player)) {
			void DiscordChatManager._dmMuteInfo(
				message.author,
				`your mute expires ${time(
					new Date(this.hypixelGuild!.mutedPlayers.get(player!.minecraftUuid)!),
					TimestampStyles.RelativeTime,
				)}`,
			);
			return MessageUtil.react(message, UnicodeEmoji.Muted);
		}

		// check if the player is auto muted
		if (player?.infractions! >= this.client.config.get('CHATBRIDGE_AUTOMUTE_MAX_INFRACTIONS')) {
			void DiscordChatManager._dmMuteInfo(message.author, 'you are currently muted due to continues infractions');
			return MessageUtil.react(message, UnicodeEmoji.Muted);
		}

		// check if guild chat is muted
		if (this.hypixelGuild!.muted && (!player || !this.hypixelGuild!.checkStaff(player))) {
			void DiscordChatManager._dmMuteInfo(
				message.author,
				`${this.hypixelGuild!.name}'s guild chat mute expires ${time(
					new Date(this.hypixelGuild!.mutedTill),
					TimestampStyles.RelativeTime,
				)}`,
			);
			return MessageUtil.react(message, UnicodeEmoji.Muted);
		}

		// check if the chatBridge bot is muted
		if (this.hypixelGuild!.checkMute(this.minecraft.botPlayer)) {
			void DiscordChatManager._dmMuteInfo(
				message.author,
				`the bot's mute expires ${time(
					new Date(this.hypixelGuild!.mutedPlayers.get(this.minecraft.botUuid)!),
					TimestampStyles.RelativeTime,
				)}`,
			);
			return MessageUtil.react(message, UnicodeEmoji.Muted);
		}

		// build content
		const contentParts: string[] = [];

		// actual content
		let messageContent =
			isEdit && !message.interaction && message.content && !message.content.endsWith('*')
				? `${message.content}*` // add a trailing '*' to indicate an edit if not already present
				: message.content;

		if (messageContent) {
			// parse discord attachment links and replace with imgur uploaded link
			if (this.client.config.get('IMGUR_UPLOADER_ENABLED')) {
				messageContent = await asyncReplace(messageContent, DISCORD_CDN_URL_REGEXP, async (match) => {
					try {
						// try to upload URL without query parameters
						return (await imgur.upload(match[1])).data.link;
					} catch (error) {
						logger.error(error, '[FORWARD DC TO MC]');
						return match[0];
					}
				});
			}

			contentParts.push(messageContent);
		}

		// stickers
		if (message.stickers.size) contentParts.push(...message.stickers.map(({ name }) => `:${name}:`));

		// links of attachments
		if (message.attachments.size) contentParts.push(...(await this._uploadAttachments(message.attachments)));

		// empty message (e.g. only embeds)
		if (!contentParts.length) return MessageUtil.react(message, UnicodeEmoji.Stop);

		// @referencedMessageAuthor if normal reply
		if (MessageUtil.isNormalReplyMessage(message)) {
			try {
				const referencedMessage = await message.fetchReference();

				// author found and author is not already pinged
				if (referencedMessage.author && !new RegExp(`<@!?${referencedMessage.author.id}>`).test(message.content)) {
					contentParts.unshift(`@${DiscordChatManager.getPlayerName(referencedMessage)}`);
				}
			} catch (error) {
				logger.error(error, '[FORWARD DC TO MC]: error fetching reference');
			}
		}

		// send interaction "command" for initial application command reply
		if (messageInteraction) {
			const interaction = this.client.chatBridges.interactionCache.get(messageInteraction.id);

			// cached interaction from the bot or interaction from another bot
			if (interaction || message.author.id !== message.client.user!.id) {
				void this.minecraft.chat({
					content: `${this.client.config.get('PREFIXES')[0]}${
						interaction
							?.toString()
							.slice(1)
							.replace(/ visibility:[a-z]+/, '') ?? messageInteraction.commandName
					}`,
					prefix: `${this.prefix} ${DiscordChatManager.formatAtMention(
						player?.ign ?? messageInteraction.user.username,
					)}: `,
				});
			}
		}

		// send content
		return this.minecraft.chat({
			content: contentParts.join(' '),
			prefix: `${this.prefix} ${
				message.author.id !== message.client.user!.id ? `${DiscordChatManager.getPlayerName(message)}: ` : ''
			}`,
			discordMessage: message,
		});
	}

	/**
	 * collects chat messages from the bot
	 * @param options
	 */
	override createMessageCollector(options?: MessageCollectorOptions) {
		return new MessageCollector(this.channel, options);
	}
}
