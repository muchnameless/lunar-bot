import {
	DiscordAPIError,
	MessageFlags,
	MessageType,
	PermissionFlagsBits,
	resolvePartialEmoji,
	RESTJSONErrorCodes,
} from 'discord.js';
import { EmbedLimits, MessageLimits } from '@sapphire/discord-utilities';
import ms from 'ms';
import { logger } from '#logger';
import { commaListAnd, minutes } from '#functions';
import { ChannelUtil, EmbedUtil } from '.';
import type {
	DiscordErrorData,
	EmojiIdentifierResolvable,
	Message,
	MessageEditOptions,
	MessageOptions,
	MessageReaction,
	TextChannel,
} from 'discord.js';
import type { SendOptions } from '.';

interface AwaitReplyOptions extends MessageOptions {
	question?: string;
	/** time in milliseconds to wait for a response */
	time?: number;
}

export interface EditOptions extends MessageEditOptions {
	rejectOnError?: boolean;
}

export class MessageUtil extends null {
	static DEFAULT_REPLY_PERMISSIONS = PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages;

	/**
	 * @param message
	 */
	static channelLogInfo(message: Message) {
		return ChannelUtil.logInfo(message.channel) ?? message.channelId;
	}

	/**
	 * @param message
	 */
	static isEphemeral(message: Message) {
		return message.flags.has(MessageFlags.Ephemeral);
	}

	/**
	 * whether the message was sent by a non-bot user account
	 * @param message
	 */
	static isUserMessage(message: Message) {
		return !message.author.bot && !message.webhookId && !message.system;
	}

	/**
	 * whether the message was sent by a non-application-command webhook
	 * @param message
	 */
	static isNormalWebhookMessage(message: Message) {
		return message.webhookId != null && message.webhookId !== message.applicationId;
	}

	/**
	 * whether the message is a reply but not to an application command
	 * @param message
	 */
	static isNormalReplyMessage(message: Message) {
		return message.type === MessageType.Reply && !message.webhookId;
	}

	/**
	 * whether the message is from the bot user and not related to application commands
	 * @param message
	 */
	static isNormalBotMessage(message: Message) {
		return (
			message.author.id === message.client.user!.id &&
			(message.type === MessageType.Default || this.isNormalReplyMessage(message))
		);
	}

	/**
	 * @param message
	 * @param emojiIndetifier
	 */
	private static _reactSingle(message: Message, emojiIndetifier: EmojiIdentifierResolvable) {
		const emoji = resolvePartialEmoji(emojiIndetifier);
		const reaction = message.reactions.cache.get(emoji?.id ?? emoji?.name!);

		return reaction?.me
			? Promise.resolve(reaction) // reaction from bot already exists
			: message.react(emojiIndetifier); // new reaction
	}

	/**
	 * react in order if the message is not deleted and the client has 'ADD_REACTIONS', catching promise rejections
	 * @param message
	 * @param emojis
	 */
	static async react(message: Message | null, ...emojis: EmojiIdentifierResolvable[]) {
		if (!message || this.isEphemeral(message)) return null;

		// permission checks
		const { channel } = message;

		if (
			!ChannelUtil.botPermissions(channel).has(
				PermissionFlagsBits.AddReactions | PermissionFlagsBits.ViewChannel | PermissionFlagsBits.ReadMessageHistory,
				false,
			)
		) {
			logger.warn(
				{ message, data: emojis },
				`[MESSAGE REACT]: missing permissions to react in ${this.channelLogInfo(message)}`,
			);
			return null;
		}

		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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

		if (this.isEphemeral(message)) {
			logger.warn(
				{ message, data: emojis },
				`[MESSAGE REACT]: unable to react to ephemeral message in ${this.channelLogInfo(message)}`,
			);
			return null;
		}

		// single reaction
		if (emojis.length === 1) {
			try {
				return await this._reactSingle(message, emojis[0]!);
			} catch (error) {
				logger.error({ message, err: error, data: emojis }, `[MESSAGE REACT]: in ${this.channelLogInfo(message)}`);
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
			logger.error({ message, err: error, data: emojis }, `[MESSAGE REACT]: in ${this.channelLogInfo(message)}`);
		}

		return res;
	}

	/**
	 * delete the message, added check for already deleted after timeout
	 * @param message
	 */
	static async delete(message: Message): Promise<Message> {
		// permission check
		if (!message.deletable) {
			logger.warn(
				message,
				`[MESSAGE DELETE]: missing permissions to delete message in ${this.channelLogInfo(message)}`,
			);
			return message;
		}

		try {
			return await message.delete();
		} catch (error) {
			logger.error({ message, err: error }, `[MESSAGE DELETE]: in ${this.channelLogInfo(message)}`);
			return message;
		}
	}

	/**
	 * posts question in same channel and returns content of first reply or null if timeout
	 * @param message
	 * @param options
	 */
	static async awaitReply(message: Message, options: string | AwaitReplyOptions = {}) {
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
			logger.error(error);
			return null;
		}
	}

	/**
	 * replies in nearest #bot-commands or in message's channel if DMs or '-c' flag set
	 * @param message
	 * @param options
	 */
	static async reply(message: Message, options: SendOptions & { rejectOnError: true }): Promise<Message>;
	static async reply(message: Message, options: string | SendOptions): Promise<Message | null>;
	static async reply(message: Message, options: string | SendOptions) {
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
				logger.error({ err: error, data: _options }, `[MESSAGE REPLY]: in ${this.channelLogInfo(message)}`);

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
			logger.error({ err: error, data: _options }, `[MESSAGE REPLY]: in ${this.channelLogInfo(message)}`);
			return null;
		}
	}

	/**
	 * edits a message, preserving @mention pings at the beginning
	 * @param message
	 * @param options
	 * @param permissions
	 */
	static async edit(
		message: Message,
		options: string | EditOptions,
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
				logger.warn({ message, data: _options }, `[MESSAGE EDIT]: ${MESSAGE} in ${this.channelLogInfo(message)}`);
				return message;
			}

			requiredChannelPermissions |= PermissionFlagsBits.ManageMessages; // removing attachments requires MANAGE_MESSAGES
		}

		if ((_options.content?.length ?? 0) > MessageLimits.MaximumLength) {
			const MESSAGE = `content length ${_options.content!.length} > ${MessageLimits.MaximumLength}`;

			if (_options.rejectOnError) throw new Error(MESSAGE);
			logger.warn({ message, data: _options }, `[MESSAGE EDIT]: ${MESSAGE} in ${this.channelLogInfo(message)}`);
			return message;
		}

		if (_options.embeds) {
			if (_options.embeds.length > MessageLimits.MaximumEmbeds) {
				const MESSAGE = `embeds length ${_options.embeds.length} > ${MessageLimits.MaximumEmbeds}`;

				if (_options.rejectOnError) throw new Error(MESSAGE);
				logger.warn({ message, data: _options }, `[MESSAGE EDIT]: ${MESSAGE} in ${this.channelLogInfo(message)}`);
				return message;
			}

			const TOTAL_LENGTH = EmbedUtil.totalLength(_options.embeds);

			if (TOTAL_LENGTH > EmbedLimits.MaximumTotalCharacters) {
				const MESSAGE = `embeds total char length ${TOTAL_LENGTH} > ${EmbedLimits.MaximumTotalCharacters}`;

				if (_options.rejectOnError) throw new Error(MESSAGE);
				logger.warn({ message, data: _options }, `[MESSAGE EDIT]: ${MESSAGE} in ${this.channelLogInfo(message)}`);
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
			logger.warn(`[MESSAGE EDIT]: ${MESSAGE} in ${ChannelUtil.logInfo(message.channel)}`);
			return message;
		}

		try {
			return await message.edit(_options);
		} catch (error) {
			if (_options.rejectOnError) throw error;
			logger.error({ message, err: error }, `[MESSAGE EDIT]: in ${this.channelLogInfo(message)}`);
			return message;
		}
	}

	/**
	 * pins a message
	 * @param message
	 * @param options
	 */
	static async pin(message: Message, { rejectOnError }: { rejectOnError?: boolean } = {}) {
		if (message.pinned) {
			const MESSAGE = 'message is already pinned';

			if (rejectOnError) throw new Error(MESSAGE);
			logger.warn({ message }, `[MESSAGE PIN]: ${MESSAGE} in ${this.channelLogInfo(message)}`);
			return message;
		}

		if (!message.pinnable) {
			const MESSAGE = 'missing permissions to pin message';

			if (rejectOnError) throw new Error(MESSAGE);
			logger.warn({ message }, `[MESSAGE PIN]: ${MESSAGE} in ${this.channelLogInfo(message)}`);
			return message;
		}

		try {
			return await message.pin();
		} catch (error) {
			if (rejectOnError) throw error;
			logger.error({ message, err: error }, `[MESSAGE PIN]: in ${this.channelLogInfo(message)}`);
			return message;
		}
	}

	/**
	 * unpins a message
	 * @param message
	 * @param options
	 */
	static async unpin(message: Message, { rejectOnError }: { rejectOnError?: boolean } = {}) {
		if (!message.pinned) {
			const MESSAGE = 'message is not pinned';

			if (rejectOnError) throw new Error(MESSAGE);
			logger.warn({ message }, `[MESSAGE UNPIN]: ${MESSAGE} in ${this.channelLogInfo(message)}`);
			return message;
		}

		if (!message.pinnable) {
			const MESSAGE = 'missing permissions to unpin message';

			if (rejectOnError) throw new Error(MESSAGE);
			logger.warn({ message }, `[MESSAGE UNPIN]: ${MESSAGE} in ${this.channelLogInfo(message)}`);
			return message;
		}

		try {
			return await message.unpin();
		} catch (error) {
			if (rejectOnError) throw error;
			logger.error({ message, err: error }, `[MESSAGE UNPIN]: in ${this.channelLogInfo(message)}`);
			return message;
		}
	}
}
