import { setTimeout, clearTimeout } from 'node:timers';
import { MessageType, Util } from 'discord.js';
import { MessageFlags, PermissionFlagsBits } from 'discord-api-types/v9';
import { commaListsAnd } from 'common-tags';
import ms from 'ms';
import { logger, seconds } from '../functions';
import { MESSAGE_MAX_CHARS, EMBEDS_MAX_AMOUNT, EMBED_MAX_CHARS } from '../constants';
import { ChannelUtil } from '.';
import type {
	Embed,
	EmojiIdentifierResolvable,
	Message,
	MessageEditOptions,
	MessageOptions,
	MessageReaction,
	Snowflake,
	TextChannel,
} from 'discord.js';
import type { SendOptions } from './ChannelUtil';

interface AwaitReplyOptions extends MessageOptions {
	question?: string;
	/** time in milliseconds to wait for a response */
	time?: number;
}

interface EditOptions extends MessageEditOptions {
	rejectOnError?: boolean;
}

interface QueuedDeletionTimeout {
	timeout: NodeJS.Timeout;
	promise: Promise<Message>;
	executionTime: number;
}

export default class MessageUtil extends null {
	static DEFAULT_REPLY_PERMISSIONS = PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages;

	static DELETE_TIMEOUT_CACHE = new Map<Snowflake, QueuedDeletionTimeout>();

	static DELETED_MESSAGES = new WeakSet<Message>();

	/**
	 * @param message
	 */
	static logInfo(message: Message) {
		return `${message.author?.tag ?? 'unknown author'}${
			message.inGuild() ? ` | ${message.member?.displayName ?? 'unknown member'}` : ''
		}`;
	}

	/**
	 * @param message
	 */
	static channelLogInfo(message: Message) {
		const { channel } = message;
		if (!channel) return message.channelId;
		return ChannelUtil.logInfo(channel);
	}

	/**
	 * @param message
	 */
	static isEphemeral(message: Message) {
		return message.flags.has(MessageFlags.Ephemeral);
	}

	/**
	 * wether the message was sent by a non-bot user account
	 * @param message
	 */
	static isUserMessage(message: Message) {
		return !message.author?.bot && !message.webhookId && !message.system;
	}

	/**
	 * wether the message was sent by a non-application-command webhook
	 * @param message
	 */
	static isNormalWebhookMessage(message: Message) {
		return message.webhookId != null && message.webhookId !== message.applicationId;
	}

	/**
	 * wether the message is a reply but not to an application command
	 * @param message
	 */
	static isNormalReplyMessage(message: Message) {
		return message.type === MessageType.Reply && !message.webhookId;
	}

	/**
	 * wether the message is from the bot user and not related to application commands
	 * @param message
	 */
	static isNormalBotMessage(message: Message) {
		return message.editable && (message.type === MessageType.Default || this.isNormalReplyMessage(message));
	}

	/**
	 * react in order if the message is not deleted and the client has 'ADD_REACTIONS', catching promise rejections
	 * @param message
	 * @param emojis
	 */
	static async react(message: Message | null, ...emojis: EmojiIdentifierResolvable[]) {
		if (!message || this.DELETED_MESSAGES.has(message) || this.isEphemeral(message)) return null;

		const { channel } = message;

		if (
			!ChannelUtil.botPermissions(channel).has(
				PermissionFlagsBits.AddReactions | PermissionFlagsBits.ViewChannel | PermissionFlagsBits.ReadMessageHistory,
			)
		) {
			logger.warn(`[MESSAGE REACT]: missing permissions in ${this.channelLogInfo(message)}`);
			return null;
		}

		if ((channel as TextChannel).guild?.me!.isCommunicationDisabled()) {
			logger.warn(
				`[MESSAGE REACT]: bot timed out in '${(channel as TextChannel).guild.name}' for ${ms(
					(channel as TextChannel).guild.me!.communicationDisabledUntilTimestamp! - Date.now(),
					{ long: true },
				)}`,
			);
			return null;
		}

		const res: MessageReaction[] = [];

		try {
			for (const emojiIndetifier of emojis) {
				const emoji = Util.resolvePartialEmoji(emojiIndetifier);
				const reaction = message.reactions.cache.get(emoji?.id ?? emoji?.name!);

				res.push(
					reaction?.me
						? reaction // reaction from bot already exists
						: await message.react(emojiIndetifier), // new reaction
				);
			}
		} catch (error) {
			logger.error(error, '[MESSAGE REACT]');
		}

		return res;
	}

	/**
	 * delete the message, added check for already deleted after timeout
	 * @param message
	 * @param options message delete options
	 */
	static async delete(message: Message, { timeout = 0 }: { timeout?: number } = {}): Promise<Message> {
		if (!message.deletable) {
			// permission check
			logger.warn(
				`[MESSAGE UTIL]: message from ${this.logInfo(message)} in ${this.channelLogInfo(message)} is not deletable`,
			);
			return message;
		}

		// TODO: remove once discord.js Message#deletable checks for ephemeral state
		if (this.isEphemeral(message)) {
			logger.warn(`[MESSAGE UTIL]: unable to delete ephemeral message in ${this.channelLogInfo(message)}`);
			return message;
		}

		// no timeout
		if (timeout <= 0) {
			this.DELETE_TIMEOUT_CACHE.delete(message.id);

			try {
				return await message.delete();
			} catch (error) {
				logger.error(
					error,
					`[MESSAGE UTIL]: delete message from ${this.logInfo(message)} in ${this.channelLogInfo(message)}`,
				);
				return message;
			}
		}

		// check if timeout is already queued
		const existing = this.DELETE_TIMEOUT_CACHE.get(message.id);
		if (existing) {
			// queued timeout resolves earlier than new one
			if (existing.executionTime - Date.now() <= timeout) return existing.promise;

			// delete queued timeout and requeue newer one
			clearTimeout(existing.timeout);
		}

		// timeout
		let res: (value: Promise<Message>) => void;
		const promise = new Promise<Message>((r) => (res = r));

		this.DELETE_TIMEOUT_CACHE.set(message.id, {
			timeout: setTimeout(() => {
				this.DELETE_TIMEOUT_CACHE.delete(message.id);
				res(this.delete(message));
			}, timeout),
			promise,
			executionTime: Date.now() + timeout,
		});

		return promise;
	}

	/**
	 * posts question in same channel and returns content of first reply or null if timeout
	 * @param message
	 * @param options
	 */
	static async awaitReply(message: Message, options: string | AwaitReplyOptions = {}) {
		const {
			question = 'confirm this action?',
			time = seconds(60),
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
	static reply(message: Message, options: SendOptions & { rejectOnError: true }): Promise<Message>;
	static reply(message: Message, options: string | SendOptions): Promise<Message | null>;
	static reply(message: Message, options: string | SendOptions) {
		const _options = typeof options === 'string' ? { content: options } : options;

		return ChannelUtil.send(message.channel, {
			reply: {
				messageReference: message,
			},
			..._options,
		});
	}

	/**
	 * edits a message, preserving @mention pings at the beginning
	 * @param message
	 * @param options
	 */
	static async edit(message: Message, options: string | EditOptions) {
		const _options = typeof options === 'string' ? { content: options } : options;

		// permission checks
		let requiredChannelPermissions = this.DEFAULT_REPLY_PERMISSIONS;

		if (!message.editable) {
			// message was not sent by the bot user -> can only remove attachments
			if (Object.keys(_options).some((key) => key !== 'attachments') || _options.attachments?.length !== 0) {
				const MESSAGE = `[MESSAGE UTIL]: can't edit message by ${this.logInfo(message)} in ${this.channelLogInfo(
					message,
				)} with ${Object.entries(_options)}`;

				if (_options.rejectOnError) throw new Error(MESSAGE);
				logger.warn(_options, MESSAGE);
				return message;
			}

			requiredChannelPermissions |= PermissionFlagsBits.ManageMessages; // removing attachments requires MANAGE_MESSAGES
		}

		// TODO: remove once discord.js Message#editable checks for ephemeral state
		if (this.isEphemeral(message)) {
			logger.warn(`[MESSAGE UTIL]: unable to edit ephemeral message in ${this.channelLogInfo(message)}`);
			return message;
		}

		if ((_options.content?.length ?? 0) > MESSAGE_MAX_CHARS) {
			const MESSAGE = `[MESSAGE UTIL]: content length ${_options.content!.length} > ${MESSAGE_MAX_CHARS}`;

			if (_options.rejectOnError) throw new Error(MESSAGE);
			logger.warn(options, MESSAGE);
			return message;
		}

		if (Reflect.has(_options, 'embeds')) {
			if (_options.embeds!.length > EMBEDS_MAX_AMOUNT) {
				const MESSAGE = `[MESSAGE UTIL]: embeds length ${_options.embeds!.length} > ${EMBEDS_MAX_AMOUNT}`;

				if (_options.rejectOnError) throw new Error(MESSAGE);
				logger.warn(options, MESSAGE);
				return message;
			}

			const TOTAL_LENGTH = _options.embeds!.reduce(
				(acc, cur) => acc + (cur as Embed).length ?? Number.POSITIVE_INFINITY,
				0,
			);

			if (TOTAL_LENGTH > EMBED_MAX_CHARS) {
				const MESSAGE = `[MESSAGE UTIL]: embeds total char length ${TOTAL_LENGTH} > ${EMBED_MAX_CHARS}`;

				if (_options.rejectOnError) throw new Error(MESSAGE);
				logger.warn(_options, MESSAGE);
				return message;
			}

			requiredChannelPermissions |= PermissionFlagsBits.EmbedLinks;
		}

		if (Reflect.has(_options, 'files')) requiredChannelPermissions |= PermissionFlagsBits.AttachFiles;

		const { channel } = message;

		if (!ChannelUtil.botPermissions(channel).has(requiredChannelPermissions)) {
			const missingChannelPermissions = ChannelUtil.botPermissions(channel)
				.missing(requiredChannelPermissions)
				.map((permission) => `'${permission}'`);

			if (_options.rejectOnError) {
				throw new Error(
					commaListsAnd`[MESSAGE UTIL]: missing ${missingChannelPermissions} permission${
						missingChannelPermissions?.length === 1 ? '' : 's'
					} in ${ChannelUtil.logInfo(channel)}
					`,
				);
			}

			logger.warn(
				commaListsAnd`[MESSAGE UTIL]: missing ${missingChannelPermissions} permission${
					missingChannelPermissions?.length === 1 ? '' : 's'
				} in ${ChannelUtil.logInfo(channel)}
				`,
			);
			return message;
		}

		try {
			return await message.edit(_options);
		} catch (error) {
			if (_options.rejectOnError) throw error;
			logger.error(
				error,
				`[MESSAGE UTIL]: edit message from ${this.logInfo(message)} in ${this.channelLogInfo(message)}`,
			);
			return message;
		}
	}

	/**
	 * pins a message
	 * @param message
	 */
	static async pin(message: Message) {
		if (!message.pinnable) {
			logger.warn(`[MESSAGE UTIL]: can't pin message by ${this.logInfo(message)} in ${this.channelLogInfo(message)}`);
			return message;
		}

		try {
			return await message.pin();
		} catch (error) {
			logger.error(
				error,
				`[MESSAGE UTIL]: pin message from ${this.logInfo(message)} in ${this.channelLogInfo(message)}`,
			);
			return message;
		}
	}
}
