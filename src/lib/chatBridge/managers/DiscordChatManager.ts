import { URL } from 'node:url';
import {
	bold,
	DiscordAPIError,
	EmbedBuilder,
	MessageCollector,
	PermissionFlagsBits,
	time,
	TimestampStyles,
	type CommandInteractionOption,
	type Message,
	type MessageCollectorOptions,
	type MessageOptions,
	type Snowflake,
	type TextChannel,
	type User,
	type Webhook,
	type WebhookMessageOptions,
} from 'discord.js';
import { fetch } from 'undici';
import { type ChatBridge } from '../ChatBridge.js';
import { type HypixelMessage } from '../HypixelMessage.js';
import { PREFIX_BY_TYPE } from '../constants/index.js';
import { ChatManager } from './ChatManager.js';
import { imgur } from '#api';
import { InteractionUserCache } from '#chatBridge/caches/InteractionUserCache.js';
import {
	ALLOWED_EXTENSIONS_REGEX,
	ALLOWED_MIMES_REGEX,
	MAX_IMAGE_UPLOAD_SIZE,
	MAX_WEBHOOKS_PER_CHANNEL,
	UnicodeEmoji,
} from '#constants';
import { asyncReplace, minutes, seconds } from '#functions';
import { logger } from '#logger';
import { type DualCommand } from '#structures/commands/DualCommand.js';
import { type ChatBridgeChannel } from '#structures/database/models/HypixelGuild.js';
import { WebhookError } from '#structures/errors/WebhookError.js';
import {
	ChannelUtil,
	InteractionUtil,
	MessageUtil,
	UserUtil,
	type InteractionUtilReplyOptions,
	type SendDMOptions,
} from '#utils';

interface SendViaBotOptions extends MessageOptions {
	content: string;
	fromMinecraft?: boolean;
	hypixelMessage?: HypixelMessage | null;
}

interface SendViaWebhookOptions extends WebhookMessageOptions {
	abortController?: AbortController;
	queuePromise?: Promise<void>;
}

export interface ForwardToMinecraftOptions {
	/**
	 * whether the message is an edit instead of a new message
	 */
	isEdit: boolean;
	/**
	 * AbortSignal to cancel forwarding the message
	 */
	signal: AbortSignal;
}

export interface ReadyDiscordChatManager extends DiscordChatManager {
	webhook: Webhook;
}

export class DiscordChatManager extends ChatManager {
	/**
	 * webhook fetching/creating & caching
	 */
	private _fetchOrCreateWebhookPromise: Promise<this> | null = null;

	/**
	 * hypixel message type
	 */
	public readonly type: keyof typeof PREFIX_BY_TYPE;

	/**
	 * discord channel id
	 */
	public readonly channelId: Snowflake;

	/**
	 * hypixel chat prefix
	 */
	public readonly prefix: typeof PREFIX_BY_TYPE[keyof typeof PREFIX_BY_TYPE];

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
	 * @param name
	 * @param contentType
	 */
	private static _getAttachmentName(name: string | null, contentType: string | null) {
		// no name -> use contentType if available
		if (name === null) {
			return `[${contentType?.slice(0, contentType.indexOf('/')) ?? 'unknown'} attachment]`;
		}

		// discord's name placeholder -> use contentType if available
		if (name.startsWith('unknown.') && contentType !== null) {
			return `[${contentType.slice(0, contentType.indexOf('/'))} attachment]`;
		}

		// name includes the extension
		return `[${name.replaceAll('.', ' ')}]`;
	}

	/**
	 * tries to upload all image attachments to imgur, replacing all successfully uploaded URLs with the imgur URLs
	 *
	 * @param attachments
	 */
	private async _uploadAttachments(attachments: Message['attachments']) {
		if (!this.client.config.get('IMGUR_UPLOADER_ENABLED')) {
			return attachments.map(({ name, contentType }) => DiscordChatManager._getAttachmentName(name, contentType));
		}

		const urls: string[] = [];

		for (const { contentType, url, size, name } of attachments.values()) {
			if (size > MAX_IMAGE_UPLOAD_SIZE || !ALLOWED_MIMES_REGEX.test(contentType!)) {
				urls.push(DiscordChatManager._getAttachmentName(name, contentType));
				continue;
			}

			try {
				urls.push((await imgur.uploadURL(url)).data.link);
			} catch (error) {
				logger.error(error, '[UPLOAD ATTACHMENTS]');
				urls.push(DiscordChatManager._getAttachmentName(name, contentType));
			}
		}

		return urls;
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
			logger.warn(`[CHATBRIDGE]: chatBridge #${this.mcAccount}: no guild to fetch webhook`);
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
	 * tries to send an ephemeral message via a cached interaction or DMs the message author
	 *
	 * @param user
	 * @param options
	 */
	public async sendDM(user: User, options: InteractionUtilReplyOptions & SendDMOptions) {
		// try ephemeral interaction followUp
		const interaction = this.interactionUserCache.get(user.id);

		if (interaction) {
			try {
				await InteractionUtil.followUp(interaction, { ...options, ephemeral: true, rejectOnError: true });
				return; // successfull
			} catch (error) {
				logger.error(error, `[SEND PRIVATE MESSAGE]: ${this.logInfo}`);

				if (InteractionUtil.isInteractionError(error)) {
					this.interactionUserCache.delete(user.id);
				}
			}
		}

		// fallback to regular DM
		void UserUtil.sendDM(user, options);
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
			throw new Error(`[SEND VIA WEBHOOK]: ${this.logInfo}: not enabled`);
		}

		// no content
		if (!options.content) {
			abortController?.abort();
			throw new Error(`[SEND VIA WEBHOOK]: ${this.logInfo}: no content`);
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
	async #sendViaWebhook(options: WebhookMessageOptions): Promise<Message> {
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
			logger.error(error, `[SEND VIA BOT]: ${this.logInfo}`);
		}

		const _options: SendViaBotOptions = {
			content: await this.chatBridge.discord.parseContent(
				`${
					discordMessage || !hypixelMessage ? '' : `${hypixelMessage.member ?? `@${hypixelMessage.author}`}, `
				}${content}`,
				fromMinecraft,
			),
			reply: discordMessage
				? {
						messageReference: discordMessage,
				  }
				: undefined,
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
	 * @param options
	 */
	public async forwardToMinecraft(message: Message, { isEdit, signal }: ForwardToMinecraftOptions) {
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
			void this.sendDM(message.author, {
				content: `your mute expires ${time(
					seconds.fromMilliseconds(this.hypixelGuild!.mutedPlayers.get(player!.minecraftUuid)!),
					TimestampStyles.RelativeTime,
				)}`,
				redisKey: `dm:${message.author.id}:chatbridge:muted`,
			});
			return void MessageUtil.react(message, UnicodeEmoji.Muted);
		}

		// check if the player is auto muted
		if (
			(player?.infractions ?? Number.NEGATIVE_INFINITY) >= this.client.config.get('CHATBRIDGE_AUTOMUTE_MAX_INFRACTIONS')
		) {
			void this.sendDM(message.author, {
				content: 'you are currently muted due to continues infractions',
				redisKey: `dm:${message.author.id}:chatbridge:muted`,
			});
			return void MessageUtil.react(message, UnicodeEmoji.Muted);
		}

		// check if guild chat is muted
		if (this.hypixelGuild!.muted && (!player || !this.hypixelGuild!.checkStaff(player))) {
			void this.sendDM(message.author, {
				content: `${this.hypixelGuild!.name}'s guild chat mute expires ${time(
					seconds.fromMilliseconds(this.hypixelGuild!.mutedTill),
					TimestampStyles.RelativeTime,
				)}`,
				redisKey: `dm:${message.author.id}:chatbridge:muted`,
			});
			return void MessageUtil.react(message, UnicodeEmoji.Muted);
		}

		// check if the chatBridge bot is muted
		if (this.hypixelGuild!.checkMute(this.minecraft.botPlayer)) {
			void this.sendDM(message.author, {
				content: `the bot's mute expires ${time(
					seconds.fromMilliseconds(this.hypixelGuild!.mutedPlayers.get(this.minecraft.botUuid!)!),
					TimestampStyles.RelativeTime,
				)}`,
				redisKey: `dm:${message.author.id}:chatbridge:muted`,
			});
			return void MessageUtil.react(message, UnicodeEmoji.Muted);
		}

		// build content
		const contentParts: string[] = [];

		// actual content
		let messageContent =
			isEdit && !messageInteraction && message.content && !message.content.endsWith('*')
				? `${message.content}*` // add a trailing '*' to indicate an edit if not already present
				: message.content;

		if (messageContent) {
			// parse discord attachment links and replace with imgur uploaded link
			if (this.client.config.get('IMGUR_UPLOADER_ENABLED')) {
				messageContent = await asyncReplace(
					messageContent,
					/https?:\/\/(?:www\.|(?!www))[\da-z][\da-z-]+[\da-z]\.\S{2,}|https?:\/\/(?:www\.|(?!www))[\da-z]+\.\S{2,}/gi,
					async (match) => {
						try {
							const url = new URL(match[0]);

							if (
								// don't upload imgur links to imgur
								url.hostname.endsWith('imgur.com') ||
								// upload only pictures
								!ALLOWED_EXTENSIONS_REGEX.test(url.pathname)
							) {
								return match[0];
							}

							// remove query parameters
							url.search = '';

							// check headers for URLs other than discord's CDN
							if (!/discordapp\.(?:net|com)$/.test(url.hostname)) {
								// TODO: cache this via redis?
								const res = await fetch(url, { method: 'HEAD', signal });
								const contentType = res.headers.get('content-type');
								const contentLength = Number.parseInt(res.headers.get('content-length')!, 10);

								if (
									Number.isNaN(contentLength) ||
									contentLength > MAX_IMAGE_UPLOAD_SIZE ||
									!ALLOWED_MIMES_REGEX.test(contentType!)
								) {
									return match[0];
								}
							}

							// try to upload URL
							return (await imgur.uploadURL(url.toString(), { signal })).data.link;
						} catch (error) {
							logger.error(error, `[FORWARD DC TO MC]: ${this.logInfo}`);
							return match[0];
						}
					},
				);
			}

			contentParts.push(messageContent);
		}

		// stickers
		if (message.stickers.size) contentParts.push(...message.stickers.map(({ name }) => `:${name}:`));

		// links of attachments
		if (message.attachments.size) contentParts.push(...(await this._uploadAttachments(message.attachments)));

		// empty message (e.g. only embeds)
		if (!contentParts.length) return void MessageUtil.react(message, UnicodeEmoji.Stop);

		// @referencedMessageAuthor if normal reply
		if (MessageUtil.isNormalReplyMessage(message)) {
			try {
				const referencedMessage = await message.fetchReference();

				// author found and author is not already pinged
				if (!new RegExp(`<@!?${referencedMessage.author.id}>`).test(message.content)) {
					contentParts.unshift(`@${await DiscordChatManager.getPlayerName(referencedMessage)}`);
				}
			} catch (error) {
				logger.error(error, `[FORWARD DC TO MC]: ${this.logInfo}: error fetching reference`);
			}
		}

		// send interaction "command" for initial application command reply
		if (messageInteraction) {
			const interaction = this.chatBridge.manager.interactionCache.get(messageInteraction.id);

			let content: string | undefined;

			// cached interaction from the bot
			if (interaction) {
				const command = this.client.commands.get(interaction.commandName) as DualCommand | undefined;

				if (command?.parseArgsOptions) {
					const commandParts: (string | null)[] = [
						interaction.commandName,
						interaction.options.getSubcommandGroup(),
						interaction.options.getSubcommand(false),
					];

					// @ts-expect-error private
					for (const { name, value } of interaction.options._hoistedOptions as CommandInteractionOption[]) {
						if (name === 'visibility') continue;

						if (Reflect.has(command.parseArgsOptions, name)) {
							commandParts.push(`--${name}`);
						}

						commandParts.push(`${value}`);
					}

					content = commandParts.filter(Boolean).join(' ');
				} else {
					content = interaction
						.toString()
						.slice('/'.length)
						.replace(/ visibility:[a-z]+/, '');
				}
			} else if (message.author.id !== message.client.user!.id) {
				// interaction from another bot
				content = messageInteraction.commandName;
			}

			if (content) {
				// message is a bot message (since it has an interaction property) -> use messageInteraction.user instead of message.author
				void this.minecraft.chat({
					content: `${this.client.config.get('PREFIXES')[0]}${content}`,
					prefix: `${this.prefix} ${DiscordChatManager._replaceBlockedName(
						player?.ign ??
							(
								await message.guild?.members
									.fetch(messageInteraction.user.id)
									.catch((error) =>
										logger.error(
											error,
											`[FORWARD DC TO MC]: ${this.logInfo}: error fetching messageInteraction member`,
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
			prefix: `${this.prefix} ${
				message.author.id === message.client.user!.id
					? ''
					: `${DiscordChatManager._replaceBlockedName(
							player?.ign ?? message.member?.displayName ?? message.author.username,
					  )}: `
			}`,
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
