import { Permissions, MessageFlags, Util } from 'discord.js';
import { setTimeout as sleep } from 'node:timers/promises';
import { commaListsAnd } from 'common-tags';
import { ChannelUtil } from '.';
import { logger, seconds } from '../functions';
import type {
	EmojiIdentifierResolvable,
	Message,
	MessageEditOptions,
	MessageOptions,
	MessageReaction,
} from 'discord.js';


interface AwaitReplyOptions extends MessageOptions {
	question?: string;
	/** time in milliseconds to wait for a response */
	time?: number;
}


export default class MessageUtil extends null {
	static DEFAULT_REPLY_PERMISSIONS = Permissions.FLAGS.VIEW_CHANNEL | Permissions.FLAGS.SEND_MESSAGES;

	/**
	 * @param message
	 */
	static logInfo(message: Message) {
		return `${message.author?.tag ?? 'unknown author'}${message.guildId ? ` | ${message.member?.displayName ?? 'unknown member'}` : ''}`;
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
		return message.flags.has(MessageFlags.FLAGS.EPHEMERAL);
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
		return message.type === 'REPLY' && !message.webhookId;
	}

	/**
	 * wether the message is from the bot user and not related to application commands
	 * @param message
	 */
	static isNormalBotMessage(message: Message) {
		return message.editable && (message.type === 'DEFAULT' || this.isNormalReplyMessage(message));
	}

	/**
	 * react in order if the message is not deleted and the client has 'ADD_REACTIONS', catching promise rejections
	 * @param message
	 * @param emojis
	 */
	static async react(message: Message | null, ...emojis: EmojiIdentifierResolvable[]) {
		if (!message || message.deleted || this.isEphemeral(message)) return null;
		if (!ChannelUtil.botPermissions(message.channel)?.has(Permissions.FLAGS.ADD_REACTIONS)) {
			logger.warn(`[MESSAGE REACT]: missing permissions in ${this.channelLogInfo(message)}`);
			return null;
		}

		const res: MessageReaction[] = [];

		try {
			for (const emojiIndetifier of emojis) {
				const emoji = Util.resolvePartialEmoji(emojiIndetifier);
				const reaction = message.reactions.cache.get(emoji?.id ?? emoji?.name!);

				res.push(reaction?.me
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
	static async delete(message: Message, { timeout = 0 }: { timeout?: number; } = {}): Promise<Message> {
		if (!message.deletable) { // permission check
			logger.warn(`[MESSAGE UTIL]: message from ${this.logInfo(message)} in ${this.channelLogInfo(message)} is not deletable`);
			return message;
		}

		// TODO: remove once discord.js Message#deletable checks for ephemeral state
		if (this.isEphemeral(message)) {
			logger.warn(`[MESSAGE UTIL]: unable to delete ephemeral message in ${this.channelLogInfo(message)}`);
			return message;
		}

		// no timeout
		if (timeout <= 0) {
			try {
				return await message.delete();
			} catch (error) {
				logger.error(error, `[MESSAGE UTIL]: delete message from ${this.logInfo(message)} in ${this.channelLogInfo(message)}`);
				return message;
			}
		}

		// timeout
		await sleep(timeout);

		return this.delete(message);
	}

	/**
	 * posts question in same channel and returns content of first reply or null if timeout
	 * @param message
	 * @param questionOrOptions
	 */
	static async awaitReply(message: Message, questionOrOptions: string | AwaitReplyOptions = {}) {
		const { question = 'confirm this action?', time = seconds(60), ...options } = typeof questionOrOptions === 'string'
			? { question: questionOrOptions }
			: questionOrOptions;

		try {
			const questionMessage = await this.reply(message, {
				content: question,
				...options,
			});

			if (!questionMessage) return null;

			const collected = await questionMessage.channel.awaitMessages({
				filter: msg => msg.author.id === message.author.id,
				max: 1,
				time,
				errors: [ 'time' ],
			});

			return collected.first()!.content;
		} catch {
			return null;
		}
	}

	/**
	 * replies in nearest #bot-commands or in message's channel if DMs or '-c' flag set
	 * @param message
	 * @param contentOrOptions
	 */
	static reply(message: Message, contentOrOptions: string | MessageOptions) {
		const options = typeof contentOrOptions === 'string'
			? { content: contentOrOptions }
			: contentOrOptions;

		return ChannelUtil.send(message.channel, {
			reply: {
				messageReference: message,
			},
			...options,
		});
	}

	/**
	 * edits a message, preserving @mention pings at the beginning
	 * @param message
	 * @param contentOrOptions
	 */
	static async edit(message: Message, contentOrOptions: string | MessageEditOptions) {
		const options = typeof contentOrOptions === 'string'
			? { content: contentOrOptions }
			: contentOrOptions;

		// permission checks
		let requiredChannelPermissions = this.DEFAULT_REPLY_PERMISSIONS;

		if (!message.editable) { // message was not sent by the bot user
			if (Object.keys(options).some(key => key !== 'attachments') || options.attachments?.length !== 0) { // can only remove attachments
				logger.warn(`[MESSAGE UTIL]: can't edit message by ${this.logInfo(message)} in ${this.channelLogInfo(message)} with ${Object.entries(options)}`);
				return message;
			}

			requiredChannelPermissions |= Permissions.FLAGS.MANAGE_MESSAGES; // removing attachments requires MANAGE_MESSAGES
		}

		if (Reflect.has(options, 'embeds')) requiredChannelPermissions |= Permissions.FLAGS.EMBED_LINKS;
		if (Reflect.has(options, 'files')) requiredChannelPermissions |= Permissions.FLAGS.ATTACH_FILES;

		const { channel } = message;

		if (!ChannelUtil.botPermissions(channel)?.has(requiredChannelPermissions)) {
			const missingChannelPermissions = ChannelUtil.botPermissions(channel)
				?.missing(requiredChannelPermissions)
				.map(permission => `'${permission}'`);

			logger.warn(commaListsAnd`[MESSAGE UTIL]: missing ${missingChannelPermissions} permission${missingChannelPermissions?.length === 1 ? '' : 's'} in ${ChannelUtil.logInfo(channel)}`);
			return message;
		}

		try {
			return await message.edit(options);
		} catch (error) {
			logger.error(error, `[MESSAGE UTIL]: edit message from ${this.logInfo(message)} in ${this.channelLogInfo(message)}`);
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
			logger.error(error, `[MESSAGE UTIL]: pin message from ${this.logInfo(message)} in ${this.channelLogInfo(message)}`);
			return message;
		}
	}
}
