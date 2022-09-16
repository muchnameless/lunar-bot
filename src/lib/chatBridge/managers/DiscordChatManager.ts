import { URL } from 'node:url';
import { stripIndents } from 'common-tags';
import {
	bold,
	DiscordAPIError,
	EmbedBuilder,
	MessageCollector,
	PermissionFlagsBits,
	SnowflakeUtil,
	time,
	TimestampStyles,
	type CommandInteractionOption,
	type Message,
	type MessageCollectorOptions,
	type MessageCreateOptions,
	type Snowflake,
	type TextChannel,
	type Webhook,
	type WebhookCreateMessageOptions,
} from 'discord.js';
import ms from 'ms';
import { fetch } from 'undici';
import { type ChatBridge } from '../ChatBridge.js';
import { type HypixelMessage } from '../HypixelMessage.js';
import { InteractionUserCache } from '../caches/index.js';
import { PREFIX_BY_TYPE, type HypixelMessageType } from '../constants/index.js';
import { ChatManager } from './ChatManager.js';
import { imgur, redis } from '#api';
import {
	ALLOWED_EXTENSIONS_REGEX,
	ALLOWED_MIMES_REGEX,
	MAX_IMAGE_UPLOAD_SIZE,
	MAX_WEBHOOKS_PER_CHANNEL,
	UnicodeEmoji,
	UNKNOWN_IGN,
} from '#constants';
import { assertNever, asyncReplace, days, hours, minutes, seconds } from '#functions';
import { logger } from '#logger';
import { type DualCommand } from '#structures/commands/DualCommand.js';
import { type ChatBridgeChannel } from '#structures/database/models/HypixelGuild.js';
import { type Player } from '#structures/database/models/Player.js';
import { WebhookError } from '#structures/errors/WebhookError.js';
import { ChannelUtil, InteractionUtil, MessageUtil, UserUtil } from '#utils';

interface SendViaBotOptions extends MessageCreateOptions {
	content: string;
	fromMinecraft?: boolean;
	hypixelMessage?: HypixelMessage | null;
}

interface SendViaWebhookOptions extends WebhookCreateMessageOptions {
	abortController?: AbortController;
	queuePromise?: Promise<void>;
}

export interface ReadyDiscordChatManager extends DiscordChatManager {
	webhook: Webhook;
}

export const enum ForwardRejectionType {
	PlayerHypixelMuted,
	PlayerAutoMuted,
	BotMuted,
	GuildMuted,
	HypixelBlocked,
	LocalBlocked,
	MessageSize,
	NoContent,
	Error,
	Spam,
	Timeout,
}

export class DiscordChatManager extends ChatManager {
	/**
	 * webhook fetching/creating & caching
	 */
	private _fetchOrCreateWebhookPromise: Promise<this> | null = null;

	/**
	 * hypixel message type
	 */
	public readonly type: HypixelMessageType;

	/**
	 * discord channel id
	 */
	public readonly channelId: Snowflake;

	/**
	 * hypixel chat prefix
	 */
	public readonly prefix: typeof PREFIX_BY_TYPE[HypixelMessageType];

	/**
	 * channel webhook
	 */
	public webhook: Webhook | null = null;

	/**
	 * chat bridge status
	 */
	public ready = false;

	/**
	 * interaction user cache
	 */
	public readonly interactionUserCache = new InteractionUserCache();

	/**
	 * @param chatBridge
	 * @param channel
	 */
	public constructor(chatBridge: ChatBridge, { type, channelId }: ChatBridgeChannel) {
		super(chatBridge);

		this.type = type;
		this.channelId = channelId;
		this.prefix = PREFIX_BY_TYPE[type];
	}

	/**
	 * player ign or member displayName or author username, *blocked* if filter check doesn't pass
	 *
	 * @param message
	 */
	public static async getPlayerName(message: Message) {
		const user = MessageUtil.isNormalWebhookMessage(message)
			? message.guild?.members.cache.find(({ displayName }) => displayName === message.author.username)?.user
			: message.author;

		return DiscordChatManager._replaceBlockedName(
			(user && (UserUtil.getPlayer(user) ?? (await message.client.players.fetch({ discordId: user.id })))?.ign) ??
				message.member?.displayName ??
				message.author.username,
		);
	}

	/**
	 * returns a placeholder instead of the name if it does not pass the filter
	 *
	 * @param name
	 */
	private static _replaceBlockedName(name: string) {
		return this.shouldBlock(name) ? '*blocked name*' : name;
	}

	/**
	 * returns an identifier for the attachment, either the name (if not "unknown") or the first part of the content type (if it exists),
	 * replaces dots with spaces since hypixel does not allow sending "URLs" in chat
	 *
	 * @param name - file name
	 * @param contentType - content type of the file (if available)
	 * @param attachmentType - used as a fallback description if the name is "unknown" or not present
	 */
	private static _getAttachmentName(
		name: string | null,
		contentType: string | null | undefined,
		attachmentType = 'attachment',
	) {
		// no name -> use contentType if available
		if (name === null) {
			return `[${contentType?.slice(0, contentType.indexOf('/')) ?? 'unknown'} ${attachmentType}]`;
		}

		// discord's name placeholder -> use contentType if available
		if (name.startsWith('unknown.') && contentType) {
			return `[${contentType.slice(0, contentType.indexOf('/'))} ${attachmentType}]`;
		}

		// name includes the extension
		return `[${name.replaceAll('.', ' ')}]`;
	}

	/**
	 * parses the file name from the URL
	 *
	 * @param url
	 * @param contentType
	 */
	private static _getAttachmentNameFromUrl(url: URL, contentType?: string | null) {
		return this._getAttachmentName(url.pathname.slice(url.pathname.lastIndexOf('/') + 1), contentType, 'link');
	}

	/**
	 * fetches and parses the content-type and content-length headers from the url
	 *
	 * @param url
	 * @param signal
	 */
	private static async _fetchContentHeaders(url: URL, signal?: AbortSignal) {
		const cacheKey = `headers:${url.href}`;
		const cached = await redis.get(cacheKey);
		if (cached) return JSON.parse(cached) as typeof result;

		const { headers } = await fetch(url, { method: 'HEAD', signal });

		const contentLength = Number.parseInt(headers.get('content-length')!, 10);
		const result = {
			contentType: headers.get('content-type'),
			// JSON.stringify converts NaN to null
			contentLength: Number.isNaN(contentLength) ? null : contentLength,
		};

		void redis.psetex(cacheKey, days(1), JSON.stringify(result));
		return result;
	}

	/**
	 * chat bridge channel
	 */
	public get channel() {
		return this.client.channels.cache.get(this.channelId) as TextChannel | undefined;
	}

	/**
	 * MinecraftChatManager
	 */
	public get minecraft() {
		return this.chatBridge.minecraft;
	}

	/**
	 * returns the promise from queueing the promise
	 *
	 * @param signal
	 */
	public async queuePromise(signal: AbortSignal = AbortSignal.timeout(minutes(1))) {
		return this.queue.wait({ signal });
	}

	/**
	 * asserts that the webhook is present
	 */
	public isReady(): this is ReadyDiscordChatManager {
		return this.ready;
	}

	/**
	 * initialise the discord chat manager
	 */
	public async init() {
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
			return await (this._fetchOrCreateWebhookPromise = this.#fetchOrCreateWebhook());
		} finally {
			this._fetchOrCreateWebhookPromise = null;
		}
	}

	/**
	 * should only ever be called from within _fetchOrCreateWebhook
	 *
	 * @internal
	 */
	async #fetchOrCreateWebhook() {
		if (!this.hypixelGuild) {
			logger.warn(this.logInfo, '[CHATBRIDGE]: no guild to fetch webhook');
			return this;
		}

		try {
			const { channel } = this;

			if (!channel) {
				throw new WebhookError('unknown channel', channel, this.hypixelGuild);
			}

			if (!ChannelUtil.botPermissions(channel).has(PermissionFlagsBits.ManageWebhooks, false)) {
				throw new WebhookError('missing `MANAGE_WEBHOOKS`', channel, this.hypixelGuild);
			}

			const webhooks = await channel.fetchWebhooks();

			let webhook = webhooks.find((wh) => wh.isIncoming() && wh.owner?.id === this.client.user!.id) ?? null;

			if (!webhook) {
				if (webhooks.size >= MAX_WEBHOOKS_PER_CHANNEL) {
					throw new WebhookError('cannot create more webhooks', channel, this.hypixelGuild);
				}

				webhook = await channel.createWebhook({
					name: `${this.hypixelGuild} Chat Bridge`,
					avatar: (channel.guild.members.me ?? this.client.user!).displayAvatarURL(),
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

			this._setWebhook(webhook);

			logger.debug(
				{ ...this.logInfo, channel: ChannelUtil.logInfo(channel) },
				'[CHATBRIDGE]: webhook fetched and cached',
			);
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

			throw new Error('failed to fetch and cache the webhook', { cause: error });
		}
	}

	/**
	 * (un)caches the bridge's webhook
	 */
	private _setWebhook(webhook: Webhook | null) {
		if (webhook) {
			this.chatBridge.manager.webhookIds.add(webhook.id);
			this.webhook = webhook;

			this.ready = true;
		} else {
			if (this.webhook) {
				this.chatBridge.manager.webhookIds.delete(this.webhook.id);
				this.webhook = null;
			}

			this.ready = false;
		}

		return this;
	}

	/**
	 * @param message
	 * @param type
	 * @param player
	 */
	public async handleForwardRejection(message: Message, type: ForwardRejectionType, player?: Player | null) {
		let emoji: UnicodeEmoji;
		let content: string | undefined;
		let redisKey: string | undefined;
		let cooldown: number | undefined;

		switch (type) {
			case ForwardRejectionType.PlayerHypixelMuted:
				emoji = UnicodeEmoji.Muted;
				content = `your mute expires ${time(
					seconds.fromMilliseconds(this.hypixelGuild!.mutedPlayers.get(player!.minecraftUuid)!),
					TimestampStyles.RelativeTime,
				)}`;
				redisKey = `dm:${message.author.id}:chatbridge:muted`;
				break;

			case ForwardRejectionType.PlayerAutoMuted:
				emoji = UnicodeEmoji.Muted;
				content = 'you are currently muted due to continues infractions';
				redisKey = `dm:${message.author.id}:chatbridge:muted`;
				break;

			case ForwardRejectionType.GuildMuted:
				emoji = UnicodeEmoji.Muted;
				content = `${this.hypixelGuild!.name}'s guild chat mute expires ${time(
					seconds.fromMilliseconds(this.hypixelGuild!.mutedTill),
					TimestampStyles.RelativeTime,
				)}`;
				redisKey = `dm:${message.author.id}:chatbridge:muted`;
				break;

			case ForwardRejectionType.BotMuted:
				emoji = UnicodeEmoji.Muted;
				content = `the bot's mute expires ${time(
					seconds.fromMilliseconds(this.hypixelGuild!.mutedPlayers.get(this.minecraft.botUuid!)!),
					TimestampStyles.RelativeTime,
				)}`;
				redisKey = `dm:${message.author.id}:chatbridge:muted`;
				break;

			case ForwardRejectionType.HypixelBlocked: {
				emoji = UnicodeEmoji.Stop;

				const _player =
					player ??
					UserUtil.getPlayer(message.author) ??
					(
						await this.client.players.model.findCreateFind({
							where: { discordId: message.author.id },
							defaults: {
								minecraftUuid: SnowflakeUtil.generate().toString(),
								ign: UNKNOWN_IGN,
								inDiscord: true,
							},
						})
					)[0];

				void _player.addInfraction();

				const { infractions } = _player;

				if (infractions >= this.client.config.get('CHATBRIDGE_AUTOMUTE_MAX_INFRACTIONS')) {
					const MUTE_DURATION = ms(this.client.config.get('CHATBRIDGE_AUTOMUTE_DURATION'), { long: true });

					void this.client.log(
						new EmbedBuilder()
							.setColor(this.client.config.get('EMBED_RED'))
							.setAuthor({
								name: message.author.tag,
								iconURL: (message.member ?? message.author).displayAvatarURL(),
								url: _player.url,
							})
							.setThumbnail(_player.imageURL)
							.setDescription(
								stripIndents`
									${bold('Auto Muted')} for ${MUTE_DURATION} due to ${infractions} infractions
									${_player.info}
								`,
							)
							.setTimestamp(),
					);

					content = `you were automatically muted for ${MUTE_DURATION} due to continues infractions`;
				} else {
					content = 'continuing to do so will result in an automatic temporary mute';
				}

				content = stripIndents`
					your message was blocked because you used a blocked word or character
					(the blocked words filter is to comply with hypixel's chat rules, removing it would simply result in a "We blocked your comment as it breaks our rules"-message)

					${content}
				`;
				break;
			}

			case ForwardRejectionType.LocalBlocked:
				emoji = UnicodeEmoji.Stop;
				content = stripIndents`
					your message was blocked because you used a blocked word or character
					(the blocked words filter is to comply with hypixel's chat rules, removing it would simply result in a "We blocked your comment as it breaks our rules"-message)
				`;
				redisKey = `dm:${message.author.id}:chatbridge:blocked`;
				cooldown = days(1);
				break;

			case ForwardRejectionType.MessageSize:
				emoji = UnicodeEmoji.Stop;
				content = stripIndents`
					your message was blocked because you are only allowed to send up to ${this.client.config.get(
						'CHATBRIDGE_DEFAULT_MAX_PARTS',
					)} messages at once
					(in-game chat messages can only be up to 256 characters long and new lines are treated as new messages)
				`;
				redisKey = `dm:${message.author.id}:chatbridge:blocked`;
				cooldown = days(1);
				break;

			case ForwardRejectionType.NoContent:
				emoji = UnicodeEmoji.Stop;
				break;

			case ForwardRejectionType.Error:
			case ForwardRejectionType.Spam:
			case ForwardRejectionType.Timeout:
				emoji = UnicodeEmoji.X;
				break;

			default:
				assertNever(type);
		}

		void MessageUtil.react(message, emoji);

		if (!content) return;

		cooldown ??= hours(1);

		// try ephemeral interaction followUp
		const interaction = this.interactionUserCache.get(message.author.id);

		if (interaction) {
			try {
				await InteractionUtil.followUp(interaction, { content, ephemeral: true, rejectOnError: true });
				if (redisKey) void redis.psetex(redisKey, cooldown, 1); // prevent additional DMs
				return; // successfull
			} catch (error) {
				logger.error({ err: error, ...this.logInfo }, '[SEND DM]');

				if (InteractionUtil.isInteractionError(error)) {
					this.interactionUserCache.delete(message.author.id);
				}
			}
		}

		// fallback to regular DM
		void UserUtil.sendDM(message.author, { content, redisKey, cooldown });
	}

	/**
	 * sends a message via the chatBridge webhook
	 *
	 * @param options
	 */
	public async sendViaWebhook({ queuePromise, abortController, ...options }: SendViaWebhookOptions) {
		// chat bridge disabled
		if (!this.chatBridge.isEnabled()) {
			abortController?.abort();
			throw new Error('[SEND VIA WEBHOOK]: ChatBridge not enabled');
		}

		// no content
		if (!options.content) {
			abortController?.abort();
			throw new Error('[SEND VIA WEBHOOK]: no message content');
		}

		// async queue
		await (queuePromise ?? this.queuePromise(abortController?.signal));

		try {
			return await this.#sendViaWebhook(options);
		} finally {
			this.queue.shift();
		}
	}

	/**
	 * should only ever be called from within sendViaWebhook
	 *
	 * @param options
	 * @internal
	 */
	async #sendViaWebhook(options: WebhookCreateMessageOptions): Promise<Message> {
		try {
			// fetch / create webhook if non existent
			if (!this.isReady()) {
				await this._fetchOrCreateWebhook();

				if (!this.isReady()) throw new Error('[SEND VIA WEBHOOK]: ChatBridge not ready');
			}

			// API request
			return (await this.webhook.send(options)) as Message;
		} catch (error) {
			// webhook deleted
			if (error instanceof DiscordAPIError && error.status === 404) {
				logger.error({ err: error, ...this.logInfo }, '[SEND VIA WEBHOOK]: webhook deleted -> recreating & resending');

				// try to obtain another webhook
				this._setWebhook(null);
				await this._fetchOrCreateWebhook();

				// resend
				return this.#sendViaWebhook(options);
			}

			throw error;
		}
	}

	/**
	 * sends a message via the bot in the chatBridge channel
	 *
	 * @param options
	 */
	public async sendViaBot({ hypixelMessage, content, fromMinecraft, ...options }: SendViaBotOptions) {
		if (!this.chatBridge.isEnabled()) return null;

		const queuePromise = this.queuePromise();

		let discordMessage: Message | null | undefined;
		try {
			discordMessage = await hypixelMessage?.discordMessage;
		} catch (error) {
			logger.error({ err: error, ...this.logInfo }, '[SEND VIA BOT]');
		}

		const _options: SendViaBotOptions = {
			content: await this.chatBridge.discord.parseContent(
				discordMessage || !hypixelMessage ? content : `${hypixelMessage.member ?? hypixelMessage.author}, ${content}`,
				fromMinecraft,
			),
			reply: discordMessage
				? {
						messageReference: discordMessage,
				  }
				: undefined,
			allowedMentions: { parse: [] },
			...options,
		};

		await queuePromise;

		try {
			// eslint-disable-next-line @typescript-eslint/return-await
			return await ChannelUtil.send(this.channel!, _options);
		} finally {
			this.queue.shift();
		}
	}

	/**
	 * forwards a discord message to in-game guild chat, prettifying discord markdown, if neither the player nor the whole guild chat is muted
	 *
	 * @param message
	 * @param signal
	 */
	public async forwardToMinecraft(message: Message, signal: AbortSignal) {
		const messageInteraction = message.author.bot
			? // reply to an interaction
			  message.interaction ??
			  // followUp to an interaction
			  (MessageUtil.isFollowUp(message)
					? message.channel.messages.cache.get(message.reference.messageId)?.interaction ?? null
					: null)
			: null;
		const player =
			UserUtil.getPlayer(messageInteraction?.user ?? message.author) ?? // cached player
			(await this.client.players.fetch({ discordId: messageInteraction?.user.id ?? message.author.id })); // uncached player

		// check if player is muted
		if (this.hypixelGuild!.checkMute(player)) {
			return this.handleForwardRejection(message, ForwardRejectionType.PlayerHypixelMuted, player);
		}

		// check if the player is auto muted
		if (
			(player?.infractions ?? Number.NEGATIVE_INFINITY) >= this.client.config.get('CHATBRIDGE_AUTOMUTE_MAX_INFRACTIONS')
		) {
			return this.handleForwardRejection(message, ForwardRejectionType.PlayerAutoMuted);
		}

		// check if guild chat is muted
		if (this.hypixelGuild!.muted && (!player || !this.hypixelGuild!.checkStaff(player))) {
			return this.handleForwardRejection(message, ForwardRejectionType.GuildMuted);
		}

		// check if the chatBridge bot is muted
		if (this.hypixelGuild!.checkMute(this.minecraft.botPlayer)) {
			return this.handleForwardRejection(message, ForwardRejectionType.BotMuted);
		}

		// build content
		const contentParts: string[] = [];

		// actual content
		let messageContent =
			// rely on editedTimestamp since first editReply after a deferReply does not modify it
			message.editedTimestamp !== null && message.content && !message.content.endsWith('*')
				? `${message.content}*` // add a trailing '*' to indicate an edit if not already present
				: message.content;

		if (messageContent) {
			// parse discord attachment links and replace with imgur uploaded link
			if (this.client.config.get('IMGUR_UPLOADER_ENABLED')) {
				messageContent = await asyncReplace(
					messageContent,
					/https?:\/\/(?:www\.|(?!www))[\da-z][\da-z-]+[\da-z]\.\S{2,}|https?:\/\/(?:www\.|(?!www))[\da-z]+\.\S{2,}/gi,
					async (match) => {
						let url: URL | undefined;

						try {
							url = new URL(match[0]);

							// no file URL or URL is not blocked on hypixel
							if (!url.pathname.includes('.') || DiscordChatManager.ALLOWED_URLS_REGEXP.test(url.hostname)) {
								return match[0];
							}

							// not an image
							if (!ALLOWED_EXTENSIONS_REGEX.test(url.pathname)) {
								return DiscordChatManager._getAttachmentNameFromUrl(url);
							}

							// remove query parameters
							url.search = '';

							// check headers
							const { contentType, contentLength } = await DiscordChatManager._fetchContentHeaders(url, signal);

							// only images up to a certain size can be uploaded
							if (
								contentLength === null ||
								contentLength > MAX_IMAGE_UPLOAD_SIZE ||
								contentType === null ||
								!ALLOWED_MIMES_REGEX.test(contentType)
							) {
								return DiscordChatManager._getAttachmentNameFromUrl(url, contentType);
							}

							// try to upload URL
							return (await imgur.uploadURL(url.toString(), signal)).data.link;
						} catch (error) {
							logger.error({ err: error, ...this.logInfo }, '[FORWARD TO MINECRAFT]');

							if (url?.pathname.includes('.')) return DiscordChatManager._getAttachmentNameFromUrl(url);
							return match[0]; // not a file URL
						}
					},
				);
			}

			contentParts.push(messageContent);
		}

		// stickers
		if (message.stickers.size) {
			for (const { name } of message.stickers.values()) {
				contentParts.push(`:${name}:`);
			}
		}

		// attachments
		if (message.attachments.size) {
			if (this.client.config.get('IMGUR_UPLOADER_ENABLED')) {
				for (const { contentType, url, size, name } of message.attachments.values()) {
					if (size > MAX_IMAGE_UPLOAD_SIZE || !ALLOWED_MIMES_REGEX.test(contentType!)) {
						contentParts.push(DiscordChatManager._getAttachmentName(name, contentType));
						continue;
					}

					try {
						contentParts.push((await imgur.uploadURL(url, signal)).data.link);
					} catch (error) {
						logger.error({ err: error, ...this.logInfo }, '[FORWARD TO MINECRAFT]');
						contentParts.push(DiscordChatManager._getAttachmentName(name, contentType));
					}
				}
			} else {
				for (const { name, contentType } of message.attachments.values()) {
					contentParts.push(DiscordChatManager._getAttachmentName(name, contentType));
				}
			}
		}

		// empty message (e.g. only embeds)
		if (!contentParts.length) {
			return this.handleForwardRejection(message, ForwardRejectionType.NoContent);
		}

		// @referencedMessageAuthor if normal reply
		if (MessageUtil.isNormalReplyMessage(message)) {
			try {
				const referencedMessage = await message.fetchReference();

				// author found and author is not already pinged
				if (!new RegExp(`<@!?${referencedMessage.author.id}>`).test(message.content)) {
					contentParts.unshift(`@${await DiscordChatManager.getPlayerName(referencedMessage)}`);
				}
			} catch (error) {
				logger.error({ err: error, ...this.logInfo }, '[FORWARD TO MINECRAFT]: error fetching reference');
			}
		}

		// send interaction "command" for initial application command reply (if the interaction is still cached)
		if (messageInteraction) {
			let content: string | undefined;

			if (message.author.id === message.client.user.id) {
				// cached interaction from the bot
				const interaction = this.chatBridge.manager.ownInteractionCache.get(messageInteraction.id);

				if (interaction) {
					const parseArgsOptions = (this.client.commands.get(interaction.commandName) as DualCommand | undefined)
						?.parseArgsOptions;
					const commandParts: (string | null)[] = [interaction.commandName];

					if (interaction.isChatInputCommand()) {
						commandParts.push(interaction.options.getSubcommandGroup(), interaction.options.getSubcommand(false));
					}

					// @ts-expect-error private
					for (const { name, value } of interaction.options._hoistedOptions as CommandInteractionOption[]) {
						if (name === 'visibility') continue;

						commandParts.push(
							parseArgsOptions ? (name in parseArgsOptions ? `--${name} ${value}` : `${value}`) : `${name}:${value}`,
						);
					}

					content = `${this.client.config.get('PREFIXES')[0]}${commandParts.filter(Boolean).join(' ')}`;
				}
			} else if (this.chatBridge.manager.otherBotInteractionCache.get(messageInteraction.id)) {
				// cached interaction from another bot
				content = `/${messageInteraction.commandName}`;
			}

			if (content) {
				// message is a bot message (since it has an interaction property) -> use messageInteraction.user instead of message.author
				void this.minecraft.chat({
					content,
					prefix: `${this.prefix}${DiscordChatManager._replaceBlockedName(
						player?.ign ??
							(
								await message.guild?.members
									.fetch(messageInteraction.user.id)
									.catch((error) =>
										logger.error(
											{ err: error, ...this.logInfo },
											'[FORWARD TO MINECRAFT]: error fetching messageInteraction member',
										),
									)
							)?.displayName ??
							messageInteraction.user.username,
					)}: `,
				});
			}
		}

		// send content
		return this.minecraft.chat({
			content: contentParts.join(' '),
			prefix: message.author.bot
				? message.author.id === message.client.user.id
					? // this bot
					  this.prefix
					: // other bot
					  `${this.prefix}${DiscordChatManager._replaceBlockedName(
							message.member?.displayName ?? message.author.username,
					  )}: `
				: // user
				  `${this.prefix}${DiscordChatManager._replaceBlockedName(
						player?.ign ?? message.member?.displayName ?? message.author.username,
				  )}: `,
			discordMessage: message,
			signal,
		});
	}

	/**
	 * collects chat messages from the bot
	 *
	 * @param options
	 */
	public override createMessageCollector(options?: MessageCollectorOptions) {
		return new MessageCollector(this.channel!, options);
	}
}
