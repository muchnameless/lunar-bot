import { Permissions } from 'discord.js';
import { setTimeout as sleep } from 'timers/promises';
import { commaListsAnd } from 'common-tags';
import { replyPingRegExp } from '../constants/bot.js';
import { ChannelUtil } from './ChannelUtil.js';
import { logger } from '../functions/logger.js';


export class MessageUtil extends null {
	static DEFAULT_REPLY_PERMISSIONS = Permissions.FLAGS.VIEW_CHANNEL | Permissions.FLAGS.SEND_MESSAGES;

	/**
	 * @param {import('discord.js').Message} message
	 */
	static logInfo(message) {
		return `${message.author?.tag ?? 'unknown author'}${message.guildId ? ` | ${message.member?.displayName ?? 'unknown member'}` : ''}`;
	}

	/**
	 * wether the command was send by a non-bot user account
	 * @param {import('discord.js').Message} message
	 */
	static isUserMessage(message) {
		return !message.author?.bot && !message.webhookId && !message.system;
	}

	/**
	 * react in order if the message is not deleted and the client has 'ADD_REACTIONS', catching promise rejections
	 * @param {?import('discord.js').Message} message
	 * @param {import('discord.js').EmojiIdentifierResolvable[]} emojis
	 */
	static async react(message, ...emojis) {
		if (!message || message.deleted) return null;
		if (!ChannelUtil.botPermissions(message.channel)?.has(Permissions.FLAGS.ADD_REACTIONS)) return null;

		/** @type {(import('discord.js').MessageReaction | Promise<import('discord.js').MessageReaction>)[]} */
		const res = [];

		try {
			for (const emoji of emojis) {
				const reaction = message.reactions.cache.get(message.client.emojis.resolveId(emoji));

				res.push(reaction?.me
					? reaction // reaction from bot already exists
					: await message.react(emoji), // new reaction
				);
			}
		} catch (error) {
			logger.error('[MESSAGE REACT]', error);
		}

		return Promise.all(res);
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
			logger.warn(`[MESSAGE DELETE]: missing permission to delete message from ${message.author.tag} in #${message.channel?.name ?? message.channelId}`);
			return message;
		}

		// no timeout
		if (timeout <= 0) return message.delete();

		// timeout
		await sleep(timeout);
		return this.delete(message);
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
		const { content, ...options } = typeof contentOrOptions === 'string'
			? { content: contentOrOptions }
			: contentOrOptions;

		return await ChannelUtil.send(message.channel, {
			content,
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
		const { content, ...options } = typeof contentOrOptions === 'string'
			? { content: contentOrOptions }
			: contentOrOptions;

		// permission checks
		let requiredChannelPermissions = this.DEFAULT_REPLY_PERMISSIONS;

		if (Reflect.has(options, 'embeds')) requiredChannelPermissions |= Permissions.FLAGS.EMBED_LINKS;
		if (Reflect.has(options, 'files')) requiredChannelPermissions |= Permissions.FLAGS.ATTACH_FILES;

		const { channel } = message;

		if (!ChannelUtil.botPermissions(channel).has(requiredChannelPermissions)) {
			const missingChannelPermissions = ChannelUtil.botPermissions(channel)
				.missing(requiredChannelPermissions)
				.map(permission => `'${permission}'`);
			const errorMessage = commaListsAnd`missing ${missingChannelPermissions} permission${missingChannelPermissions.length === 1 ? '' : 's'} in`;

			return logger.warn(`${errorMessage} #${channel.name}`);
		}

		if (!content) return message.edit(options);

		const pingMatched = message.content?.match(replyPingRegExp)?.[0];

		return message.edit({
			content: pingMatched && !content.startsWith(pingMatched)
				? `${pingMatched}${content}`
				: content,
			...options,
		});
	}
}
