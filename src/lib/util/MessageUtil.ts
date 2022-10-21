import { EmbedLimits, MessageLimits } from '@sapphire/discord-utilities';
import {
	DiscordAPIError,
	MessageFlags,
	MessageType,
	PermissionFlagsBits,
	resolvePartialEmoji,
	RESTJSONErrorCodes,
	type DiscordErrorData,
	type EmojiIdentifierResolvable,
	type Message,
	type MessageCreateOptions,
	type MessageEditOptions,
	type MessageReaction,
	type TextChannel,
} from 'discord.js';
import ms from 'ms';
import { ChannelUtil, EmbedUtil, UserUtil, type SendOptions } from './index.js';
import { commaListAnd, minutes } from '#functions';
import { logger } from '#logger';

interface ReplyMessage extends Message {
	reference: NonNullable<Message['reference']> & {
		messageId: NonNullable<NonNullable<Message['reference']>['messageId']>;
	};
}

interface FollowUpMessage extends ReplyMessage {
	webhookId: NonNullable<Message['webhookId']>;
}

interface AwaitReplyOptions extends MessageCreateOptions {
	question?: string;
	/**
	 * time in milliseconds to wait for a response
	 */
	time?: number;
}

export interface EditOptions extends MessageEditOptions {
	rejectOnError?: boolean;
}

export class MessageUtil extends null {
	private static readonly DEFAULT_REPLY_PERMISSIONS =
		PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages;

	/**
	 * @param message
	 */
	public static logInfo(message: Message) {
		return {
			messageId: message.id,
			content: message.content,
			messageType: MessageType[message.type],
			flags: message.flags.toArray(),
			author: UserUtil.logInfo(message.author),
			channel: ChannelUtil.logInfo(message.channel),
		};
	}

	/**
	 * @param message
	 */
	public static isEphemeral(message: Message) {
		return message.flags.has(MessageFlags.Ephemeral);
	}

	/**
	 * whether the message was sent by a non-bot user account
	 *
	 * @param message
	 */
	public static isUserMessage(message: Message) {
		return !message.author.bot && !message.webhookId && !message.system;
	}

	/**
	 * whether the message was sent by a non-application-command webhook
	 *
	 * @param message
	 */
	public static isNormalWebhookMessage(message: Message) {
		return message.webhookId !== null && message.webhookId !== message.applicationId;
	}

	/**
	 * whether the message is a reply but not a followUp to an application command
	 *
	 * @param message
	 */
	public static isNormalReplyMessage(message: Message): message is ReplyMessage {
		return message.type === MessageType.Reply && message.webhookId === null;
	}

	/**
	 * whether the message is a followUp to an interaction
	 *
	 * @param message
	 */
	public static isFollowUp(message: Message): message is FollowUpMessage {
		return (
			message.type === MessageType.Reply && message.webhookId !== null && message.webhookId === message.applicationId
		);
	}

	/**
	 * whether the message is from the bot user and not related to application commands
	 *
	 * @param message
	 */
	public static isNormalBotMessage(message: Message) {
		return (
			message.author.id === message.client.user.id &&
			(message.type === MessageType.Default || this.isNormalReplyMessage(message))
		);
	}

	/**
	 * @param message
	 * @param emojiIndetifier
	 */
	private static async _reactSingle(message: Message, emojiIndetifier: EmojiIdentifierResolvable) {
		const emoji = resolvePartialEmoji(emojiIndetifier);
		// eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
		const reaction = message.reactions.cache.get(emoji?.id ?? emoji?.name!);

		return reaction?.me
			? reaction // reaction from bot already exists
			: message.react(emojiIndetifier); // new reaction
	}

	/**
	 * react in order if the message is not deleted and the client has 'ADD_REACTIONS', catching promise rejections
	 *
	 * @param message
	 * @param emojis
	 */
	public static async react(message: Message, ...emojis: EmojiIdentifierResolvable[]) {
		if (this.isEphemeral(message)) {
			logger.warn({ ...this.logInfo(message), data: emojis }, '[MESSAGE REACT]: ephemeral message');
			return null;
		}

		// permission checks
		const { channel } = message;

		if (
			!ChannelUtil.botPermissions(channel).has(
				PermissionFlagsBits.AddReactions | PermissionFlagsBits.ViewChannel | PermissionFlagsBits.ReadMessageHistory,
				false,
			)
		) {
			logger.warn({ ...this.logInfo(message), data: emojis }, '[MESSAGE REACT]: missing permissions');
			return null;
		}

		if ((channel as TextChannel).guild?.members.me!.isCommunicationDisabled()) {
			logger.warn(
				{ message, data: emojis },
				`[MESSAGE REACT]: bot timed out in '${(channel as TextChannel).guild.name}' for ${ms(
					(channel as TextChannel).guild.members.me!.communicationDisabledUntilTimestamp! - Date.now(),
					{ long: true },
				)}`,
			);
			return null;
		}

		// single reaction
		if (emojis.length === 1) {
			try {
				return await this._reactSingle(message, emojis[0]!);
			} catch (error) {
				logger.error({ err: error, ...this.logInfo(message), data: emojis }, '[MESSAGE REACT]');
				return null;
			}
		}

		// multiple reactions
		const res: MessageReaction[] = [];

		try {
			for (const emojiIndetifier of emojis) {
				res.push(await this._reactSingle(message, emojiIndetifier));
			}
		} catch (error) {
			logger.error({ err: error, ...this.logInfo(message), data: emojis }, '[MESSAGE REACT]');
		}

		return res;
	}

	/**
	 * delete the message, added check for already deleted after timeout
	 *
	 * @param message
	 */
	public static async delete(message: Message): Promise<Message> {
		// permission check
		if (!message.deletable) {
			logger.warn(this.logInfo(message), '[MESSAGE DELETE]: missing permissions to delete message');
			return message;
		}

		try {
			return await message.delete();
		} catch (error) {
			logger.error({ err: error, ...this.logInfo(message) }, '[MESSAGE DELETE]');
			return message;
		}
	}

	/**
	 * posts question in same channel and returns content of first reply or null if timeout
	 *
	 * @param message
	 * @param options
	 */
	public static async awaitReply(message: Message, options: AwaitReplyOptions | string = {}) {
		const {
			question = 'confirm this action?',
			time = minutes(1),
			..._options
		} = typeof options === 'string' ? { question: options } : options;

		try {
			const { channel } = await this.reply(message, {
				content: question,
				rejectOnError: true,
				..._options,
			});

			const collected = await channel.awaitMessages({
				filter: (msg) => msg.author.id === message.author.id,
				max: 1,
				time,
			});

			return collected.first()?.content ?? null;
		} catch (error) {
			logger.error({ err: error, options }, '[MESSAGE AWAIT REPLY]');
			return null;
		}
	}

	/**
	 * replies in nearest #bot-commands or in message's channel if DMs or '-c' flag set
	 *
	 * @param message
	 * @param options
	 */
	public static async reply(message: Message, options: SendOptions & { rejectOnError: true }): Promise<Message>;
	public static async reply(message: Message, options: SendOptions | string): Promise<Message | null>;
	public static async reply(message: Message, options: SendOptions | string) {
		const _options = typeof options === 'string' ? { content: options } : options;

		try {
			return await ChannelUtil.send(message.channel, {
				..._options,
				reply: {
					messageReference: message,
					failIfNotExists: true,
				},
				rejectOnError: true,
			});
		} catch (error) {
			// messageReference has been deleted / is an invalid id
			if (
				error instanceof DiscordAPIError &&
				error.code === RESTJSONErrorCodes.InvalidFormBodyOrContentType &&
				((error.rawError as DiscordErrorData).errors as Record<string, unknown> | undefined)?.message_reference
			) {
				logger.error({ err: error, ...this.logInfo(message), data: _options }, '[MESSAGE REPLY]');

				// don't change pinging behaviour and don't modify allowedMentions.users ref
				const allowedMentions = _options.allowedMentions ?? message.client.options.allowedMentions ?? {};
				if (allowedMentions.repliedUser) {
					if (!allowedMentions.parse?.includes('users') || !allowedMentions.users?.includes(message.author.id)) {
						_options.allowedMentions ??= {};
						_options.allowedMentions.users = [message.author.id, ...(allowedMentions.users ?? [])];
					}
				} else if (allowedMentions.users?.includes(message.author.id)) {
					_options.allowedMentions ??= {};
					_options.allowedMentions.users = allowedMentions.users.filter((id) => id !== message.author.id);
				}

				const mention = message.author.toString();

				// retry with a standard ping
				return ChannelUtil.send(message.channel, {
					..._options,
					reply: undefined,
					content: _options.content?.startsWith(mention)
						? _options.content
						: _options.content
						? `${mention}, ${_options.content}`
						: mention,
				});
			}

			if (_options.rejectOnError) throw error;
			logger.error({ err: error, ...this.logInfo(message), data: _options }, '[MESSAGE REPLY]');
			return null;
		}
	}

	/**
	 * edits a message, preserving @mention pings at the beginning
	 *
	 * @param message
	 * @param options
	 * @param permissions
	 */
	public static async edit(
		message: Message,
		options: EditOptions | string,
		permissions = ChannelUtil.botPermissions(message.channel),
	) {
		const _options = typeof options === 'string' ? { content: options } : options;

		// permission checks
		let requiredChannelPermissions = this.DEFAULT_REPLY_PERMISSIONS;

		if (!message.editable) {
			// message was not sent by the bot user -> can only remove attachments
			if (Object.keys(_options).some((key) => key !== 'attachments') || _options.attachments?.length !== 0) {
				const MESSAGE = 'missing permissions to edit message';

				if (_options.rejectOnError) throw new Error(MESSAGE);
				logger.warn({ ...this.logInfo(message), data: _options }, `[MESSAGE EDIT]: ${MESSAGE}`);
				return message;
			}

			requiredChannelPermissions |= PermissionFlagsBits.ManageMessages; // removing attachments requires MANAGE_MESSAGES
		}

		if ((_options.content?.length ?? 0) > MessageLimits.MaximumLength) {
			const MESSAGE = `content length ${_options.content!.length} > ${MessageLimits.MaximumLength}`;

			if (_options.rejectOnError) throw new Error(MESSAGE);
			logger.warn({ ...this.logInfo(message), data: _options }, `[MESSAGE EDIT]: ${MESSAGE}`);
			return message;
		}

		if (_options.embeds) {
			if (_options.embeds.length > MessageLimits.MaximumEmbeds) {
				const MESSAGE = `embeds length ${_options.embeds.length} > ${MessageLimits.MaximumEmbeds}`;

				if (_options.rejectOnError) throw new Error(MESSAGE);
				logger.warn({ ...this.logInfo(message), data: _options }, `[MESSAGE EDIT]: ${MESSAGE}`);
				return message;
			}

			const TOTAL_LENGTH = EmbedUtil.totalLength(_options.embeds);

			if (TOTAL_LENGTH > EmbedLimits.MaximumTotalCharacters) {
				const MESSAGE = `embeds total char length ${TOTAL_LENGTH} > ${EmbedLimits.MaximumTotalCharacters}`;

				if (_options.rejectOnError) throw new Error(MESSAGE);
				logger.warn({ ...this.logInfo(message), data: _options }, `[MESSAGE EDIT]: ${MESSAGE}`);
				return message;
			}

			requiredChannelPermissions |= PermissionFlagsBits.EmbedLinks;
		}

		if (_options.files) requiredChannelPermissions |= PermissionFlagsBits.AttachFiles;

		if (!permissions.has(requiredChannelPermissions, false)) {
			const missingChannelPermissions = permissions
				.missing(requiredChannelPermissions, false)
				.map((permission) => `'${permission}'`);
			const MESSAGE = `missing ${commaListAnd(missingChannelPermissions)} permission${
				missingChannelPermissions.length === 1 ? '' : 's'
			}`;

			if (_options.rejectOnError) throw new Error(MESSAGE);
			logger.warn(this.logInfo(message), `[MESSAGE EDIT]: ${MESSAGE}`);
			return message;
		}

		try {
			return await message.edit(_options);
		} catch (error) {
			if (_options.rejectOnError) throw error;
			logger.error({ err: error, ...this.logInfo(message) }, '[MESSAGE EDIT]');
			return message;
		}
	}

	/**
	 * pins a message
	 *
	 * @param message
	 * @param options
	 */
	public static async pin(message: Message, { rejectOnError }: { rejectOnError?: boolean } = {}) {
		if (message.pinned) {
			const MESSAGE = 'message is already pinned';

			if (rejectOnError) throw new Error(MESSAGE);
			logger.warn(this.logInfo(message), `[MESSAGE PIN]: ${MESSAGE}`);
			return message;
		}

		if (!message.pinnable) {
			const MESSAGE = 'missing permissions to pin message';

			if (rejectOnError) throw new Error(MESSAGE);
			logger.warn(this.logInfo(message), `[MESSAGE PIN]: ${MESSAGE}`);
			return message;
		}

		try {
			return await message.pin();
		} catch (error) {
			if (rejectOnError) throw error;
			logger.error({ err: error, ...this.logInfo(message) }, '[MESSAGE PIN]');
			return message;
		}
	}

	/**
	 * unpins a message
	 *
	 * @param message
	 * @param options
	 */
	public static async unpin(message: Message, { rejectOnError }: { rejectOnError?: boolean } = {}) {
		if (!message.pinned) {
			const MESSAGE = 'message is not pinned';

			if (rejectOnError) throw new Error(MESSAGE);
			logger.warn(this.logInfo(message), `[MESSAGE UNPIN]: ${MESSAGE}`);
			return message;
		}

		if (!message.pinnable) {
			const MESSAGE = 'missing permissions to unpin message';

			if (rejectOnError) throw new Error(MESSAGE);
			logger.warn(this.logInfo(message), `[MESSAGE UNPIN]: ${MESSAGE}`);
			return message;
		}

		try {
			return await message.unpin();
		} catch (error) {
			if (rejectOnError) throw error;
			logger.error({ err: error, ...this.logInfo(message) }, '[MESSAGE UNPIN]');
			return message;
		}
	}
}
