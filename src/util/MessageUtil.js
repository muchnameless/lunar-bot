import { Permissions, MessageFlags, Util } from 'discord.js';
import { setTimeout as sleep } from 'timers/promises';
import { commaListsAnd } from 'common-tags';
import { ChannelUtil } from './index.js';
import { logger } from '../functions/index.js';


export default class MessageUtil extends null {
	static DEFAULT_REPLY_PERMISSIONS = Permissions.FLAGS.VIEW_CHANNEL | Permissions.FLAGS.SEND_MESSAGES;

	/**
	 * @param {import('discord.js').Message} message
	 */
	static logInfo(message) {
		return `${message.author?.tag ?? 'unknown author'}${message.guildId ? ` | ${message.member?.displayName ?? 'unknown member'}` : ''}`;
	}

	/**
	 * @param {import('discord.js').Message} message
	 */
	static channelLogInfo(message) {
		const { channel } = message;
		if (!channel) return message.channelId;
		return ChannelUtil.logInfo(channel);
	}

	/**
	 * @param {import('discord.js').Message} message
	 */
	static isEphemeral(message) {
		return message.flags.has(MessageFlags.FLAGS.EPHEMERAL);
	}

	/**
	 * wether the message was sent by a non-bot user account
	 * @param {import('discord.js').Message} message
	 */
	static isUserMessage(message) {
		return !message.author?.bot && !message.webhookId && !message.system;
	}

	/**
	 * wether the message was sent by a non-application-command webhook
	 * @param {import('discord.js').Message} message
	 */
	static isNormalWebhookMessage(message) {
		return message.webhookId && message.webhookId !== message.applicationId;
	}

	/**
	 * wether the message is a reply but not to an application command
	 * @param {import('discord.js').Message} message
	 */
	static isNormalReplyMessage(message) {
		return message.type === 'REPLY' && !message.webhookId;
	}

	/**
	 * wether the message is from the bot user and not related to application commands
	 * @param {import('discord.js').Message} message
	 */
	static isNormalBotMessage(message) {
		return message.editable && (message.type === 'DEFAULT' || this.isNormalReplyMessage(message));
	}

	/**
	 * react in order if the message is not deleted and the client has 'ADD_REACTIONS', catching promise rejections
	 * @param {?import('discord.js').Message} message
	 * @param {import('discord.js').EmojiIdentifierResolvable[]} emojis
	 */
	static async react(message, ...emojis) {
		if (!message || message.deleted || this.isEphemeral(message)) return null;
		if (!ChannelUtil.botPermissions(message.channel)?.has(Permissions.FLAGS.ADD_REACTIONS)) return logger.warn(`[MESSAGE REACT]: missing permissions in ${this.channelLogInfo(message)}`);

		const res = [];

		try {
			for (const emojiIndetifier of emojis) {
				const emoji = Util.resolvePartialEmoji(emojiIndetifier);
				const reaction = message.reactions.cache.get(emoji?.id ?? emoji?.name);

				res.push(reaction?.me
					? reaction // reaction from bot already exists
					: await message.react(emojiIndetifier), // new reaction
				);
			}
		} catch (error) {
			logger.error('[MESSAGE REACT]', error);
		}

		return res;
	}

	/**
	 * delete the message, added check for already deleted after timeout
	 * @param {import('discord.js').Message} message
	 * @param {{ timeout: number }} options message delete options
	 * @returns {Promise<import('discord.js').Message>}
	 */
	static async delete(message, { timeout = 0 } = {}) {
		if (message.deleted) return message; // message already deleted check

		if (!message.deletable) { // permission check
			logger.warn(`[MESSAGE UTIL]: missing permission to delete message from ${this.logInfo(message)} in ${this.channelLogInfo(message)}`);
			return message;
		}

		// no timeout
		if (timeout <= 0) return message.delete();

		// timeout
		await sleep(timeout);

		try {
			return await this.delete(message);
		} catch (error) {
			logger.error(`[MESSAGE UTIL]: delete message from ${this.logInfo(message)} in ${this.channelLogInfo(message)}`, error);
			return message;
		}
	}

	/**
	 * posts question in same channel and returns content of first reply or null if timeout
	 * @param {import('discord.js').Message} message
	 * @param {MessageReplyOptions & { question: string, timeoutSeconds: number }} questionOrOptions
	 */
	static async awaitReply(message, questionOrOptions) {
		const { question = 'confirm this action?', timeoutSeconds = 60, ...options } = typeof questionOrOptions === 'string'
			? { question: questionOrOptions }
			: questionOrOptions;

		try {
			const questionMessage = await this.reply(message, {
				content: question,
				saveReplyMessageId: false,
				...options,
			});

			if (!questionMessage) return null;

			const collected = await questionMessage.channel.awaitMessages({
				filter: msg => msg.author.id === message.author.id,
				max: 1,
				time: timeoutSeconds * 1_000,
				errors: [ 'time' ],
			});

			return collected.first().content;
		} catch {
			return null;
		}
	}

	/**
	 * @typedef {import('discord.js').MessageOptions & { sameChannel: boolean, saveReplyMessageId: boolean, editPreviousMessage: boolean }} MessageReplyOptions
	 */

	/**
	 * replies in nearest #bot-commands or in message's channel if DMs or '-c' flag set
	 * @param {import('discord.js').Message} message
	 * @param {string | MessageReplyOptions} contentOrOptions
	 */
	static async reply(message, contentOrOptions) {
		const options = typeof contentOrOptions === 'string'
			? { content: contentOrOptions }
			: contentOrOptions;

		return await ChannelUtil.send(message.channel, {
			reply: {
				messageReference: message,
			},
			...options,
		});
	}

	/**
	 * edits a message, preserving @mention pings at the beginning
	 * @param {import('discord.js').Message} message
	 * @param {string | import('discord.js').MessageEditOptions} contentOrOptions
	 */
	static async edit(message, contentOrOptions) {
		const options = typeof contentOrOptions === 'string'
			? { content: contentOrOptions }
			: contentOrOptions;

		// permission checks
		let requiredChannelPermissions = this.DEFAULT_REPLY_PERMISSIONS;

		if (!message.editable) { // message was not sent by the bot user
			if (Object.keys(options).some(key => key !== 'attachments') || options.attachments?.length !== 0) { // can only remove attachments
				return logger.warn(`[MESSAGE UTIL]: can't edit message by ${this.logInfo(message)} in ${this.channelLogInfo(message)} with ${Object.entries(options)}`);
			}

			requiredChannelPermissions |= Permissions.FLAGS.MANAGE_MESSAGES; // removing attachments requires MANAGE_MESSAGES
		}

		if (Reflect.has(options, 'embeds')) requiredChannelPermissions |= Permissions.FLAGS.EMBED_LINKS;
		if (Reflect.has(options, 'files')) requiredChannelPermissions |= Permissions.FLAGS.ATTACH_FILES;

		const { channel } = message;

		if (!ChannelUtil.botPermissions(channel).has(requiredChannelPermissions)) {
			const missingChannelPermissions = ChannelUtil.botPermissions(channel)
				.missing(requiredChannelPermissions)
				.map(permission => `'${permission}'`);

			return logger.warn(commaListsAnd`[MESSAGE UTIL]: missing ${missingChannelPermissions} permission${missingChannelPermissions.length === 1 ? '' : 's'} in ${ChannelUtil.logInfo(channel)}`);
		}

		try {
			return await message.edit(options);
		} catch (error) {
			return logger.error(`[MESSAGE UTIL]: edit message from ${this.logInfo(message)} in ${this.channelLogInfo(message)}`, error);
		}
	}
}
