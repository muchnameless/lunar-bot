'use strict';

const { basename } = require('path');
const { stripIndents, commaListsAnd } = require('common-tags');
const { Structures, MessageEmbed, Message, Permissions } = require('discord.js');
const { CHANNEL_FLAGS, replyPingRegExp } = require('../../constants/bot');
const { DM_KEY, REPLY_KEY } = require('../../constants/redis');
const cache = require('../../api/cache');
const logger = require('../../functions/logger');


class LunarMessage extends Message {
	constructor(...args) {
		super(...args);

		this.sendReplyChannel = true;
	}

	static DEFAULT_COMMAND_CHANNEL_PERMISSIONS = Permissions.FLAGS.VIEW_CHANNEL | Permissions.FLAGS.SEND_MESSAGES;

	get logInfo() {
		return `${this.author?.tag ?? 'unknown author'}${this.guild ? ` | ${this.member?.displayName ?? 'unknown member'}` : ''}`;
	}

	/**
	 * wether the command was send by a non-bot user account
	 */
	get isUserMessage() {
		return !this.author.bot && !this.webhookID && !this.system;
	}

	/**
	 * wether the message was sent by the bot
	 */
	get me() {
		return this.author?.id === this.client.user.id;
	}

	/**
	 * scans the message.content for a 'channel' flag
	 */
	get shouldReplyInSameChannel() {
		return this.channel.isTicket
			|| (this.content
				?.split(/ +/)
				.filter(x => x.startsWith('-'))
				.some(x => CHANNEL_FLAGS.includes(x.toLowerCase().replace(/^-+/, '')))
			?? false);
	}

	/**
	 * @typedef {object} ReplyData
	 * @property {string} channelID
	 * @property {string|string[]} messageID
	 */

	/**
	 * cached message reply data
	 * @returns {Promise<?ReplyData>}
	 */
	get replyData() {
		return cache.get(`${REPLY_KEY}:${this.cachingKey}`);
	}

	/**
	 * caches the reply data for 1 hour
	 * @param {ReplyData} input
	 */
	set replyData({ channelID, messageID }) {
		cache.set(
			`${REPLY_KEY}:${this.cachingKey}`,
			{
				channelID,
				messageID,
			},
			30 * 60_000, // 30 min ttl
		);
	}

	/**
	 * part of the caching key unique to the message
	 */
	get cachingKey() {
		return `${this.guild?.id ?? DM_KEY}:${this.channel.id}:${this.id}`;
	}

	/**
	 * returns the nearest 'bot-commands'-channel with all required permissions for the bot and the message.member
	 * @param {string[]} requiredChannelPermissions
	 * @returns {import('./TextChannel')}
	 */
	findNearestCommandsChannel(requiredChannelPermissions = LunarMessage.DEFAULT_COMMAND_CHANNEL_PERMISSIONS) {
		if (!this.guild) return null;

		return this.channel.parent.children.find((/** @type {import('./TextChannel')} */ channel) => channel.name.includes('commands')
			&& channel.botPermissions.has(requiredChannelPermissions)
			&& channel.permissionsFor(this.member).has(LunarMessage.DEFAULT_COMMAND_CHANNEL_PERMISSIONS),
		)
			?? this.guild.channels.cache
				.filter((/** @type {import('./TextChannel')} */ channel) => channel.name.includes('commands')
					&& channel.botPermissions.has(requiredChannelPermissions)
					&& channel.permissionsFor(this.member).has(LunarMessage.DEFAULT_COMMAND_CHANNEL_PERMISSIONS),
				)
				.sort((a, b) => Math.abs(a.rawPosition - this.channel.rawPosition) - Math.abs(b.rawPosition - this.channel.rawPosition))
				.first();
	}

	/**
	 * react in order if the message is not deleted and the client has 'ADD_REACTIONS', catching promise rejections
	 * @param {import('discord.js').EmojiIdentifierResolvable[]} emojis
	 * @returns {Promise<?import('discord.js').MessageReaction[]>}
	 */
	async react(...emojis) {
		if (this.deleted) return null;
		if (!this.channel.botPermissions.has(Permissions.FLAGS.ADD_REACTIONS)) return null;

		const res = [];

		try {
			for (const emoji of emojis) {
				if (this.reactions.cache.get(this.client.emojis.resolveID(emoji))?.me) {
					res.push(this.reactions.cache.get(this.client.emojis.resolveID(emoji)));
				} else {
					res.push(await super.react(emoji));
				}
			}
		} catch (error) {
			logger.error('[MESSAGE REACT]', error);
		}

		return res;
	}

	/**
	 * delete the message, added check for already deleted after timeout
	 * @param {object} options message delete options
	 * @param {number} [options.timeout] delay in ms
	 * @returns {Promise<this>}
	 */
	async delete({ timeout = 0 } = {}) {
		if (this.deleted) return this; // message already deleted check

		if (!this.deletable) { // permission check
			logger.warn(`[MESSAGE DELETE]: missing permission to delete message from ${this.author.tag} in #${this.channel.name}`);
			return this;
		}

		// no timeout
		if (timeout <= 0) return super.delete();

		// timeout
		return new Promise(resolve => this.client.setTimeout(() => resolve(this.delete()), timeout));
	}

	/**
	 * posts question in same channel and returns content of first reply or null if timeout
	 * @param {string} question the question to ask the message author
	 * @param {number} timeoutSeconds secods before the question timeouts
	 * @param {object} options message reply options
	 */
	async awaitReply(question, timeoutSeconds = 60, options = {}) {
		try {
			const questionMessage = await this.reply(question, { saveReplyMessageID: false, ...options });

			if (!questionMessage) return null;

			this.sendReplyChannel = false; // to not ping the author with #bot-commands a second time

			const collected = await questionMessage.channel.awaitMessages(
				msg => msg.author.id === this.author.id,
				{ max: 1, time: timeoutSeconds * 1000, errors: [ 'time' ] },
			);

			return collected.first().content;
		} catch {
			return null;
		}
	}

	/**
	 * @typedef {import('discord.js').MessageOptions & { sameChannel: boolean, saveReplyMessageID: boolean, editPreviousMessage: boolean }} MessageReplyOptions
	 */

	/**
	 * replies in nearest #bot-commands or in message's channel if DMs or '-c' flag set
	 * @param {string} contentInput message reply content
	 * @param {MessageReplyOptions} [optionsInput] message reply options
	 * @returns {Promise<?LunarMessage>}
	 */
	async reply(contentInput, optionsInput = {}) {
		// analyze input and create (content, options)-argument
		const options = {
			embed: null,
			sameChannel: false,
			saveReplyMessageID: true,
			editPreviousMessage: true,
			...optionsInput, // create a deep copy to not modify the source object
		};

		/** @type {string} */
		let content;

		// only object as first arg provided
		if (typeof contentInput === 'object') {
			if (contentInput instanceof MessageEmbed) {
				options.embed = contentInput;
				content = null;
			} else if (!Array.isArray(contentInput)) { // unknown options object
				content = contentInput.content ?? null;
			} else {
				content = contentInput;
			}
		} else {
			content = contentInput;
		}

		// DMs
		if (!this.guild) {
			return this._sendReply(
				content,
				{
					reply: {
						messageReference: this,
						failIfNotExists: false,
					},
					...options,
				},
			);
		}

		// guild -> requires permission
		let requiredChannelPermissions = LunarMessage.DEFAULT_COMMAND_CHANNEL_PERMISSIONS;

		if (options.embed) {
			requiredChannelPermissions |= Permissions.FLAGS.EMBED_LINKS;
			if (options.embed.files?.length) requiredChannelPermissions |= Permissions.FLAGS.ATTACH_FILES;
		}

		// commands channel / reply in same channel option or flag
		if (this.channel.name.includes('commands') || options.sameChannel || this.shouldReplyInSameChannel) {
			// permission checks
			if (!this.channel.botPermissions.has(requiredChannelPermissions)) {
				const missingChannelPermissions = this.channel.botPermissions
					.missing(requiredChannelPermissions)
					.map(permission => `'${permission}'`);
				const errorMessage = commaListsAnd`missing ${missingChannelPermissions} permission${missingChannelPermissions.length === 1 ? '' : 's'} in`;

				logger.warn(`${errorMessage} #${this.channel.name}`);

				this.author
					.send(`${errorMessage} ${this.channel}`)
					.catch(() => logger.error(`[REPLY]: unable to DM ${this.author.tag} | ${this.member.displayName}`));

				return null;
			}

			if (content) this.client.chatBridges.handleDiscordMessage(this, { checkifNotFromBot: false });

			// send reply
			const message = await this._sendReply(
				content,
				{
					reply: {
						messageReference: this,
						failIfNotExists: false,
					},
					...options,
				},
			);

			if (content) this.client.chatBridges.handleDiscordMessage(message, { checkifNotFromBot: false, player: this.author.player });

			return message;
		}

		// redirect reply to nearest #bot-commands channel
		const commandsChannel = this.findNearestCommandsChannel(requiredChannelPermissions);

		// no #bot-commands channel found
		if (!commandsChannel) {
			if (this.channel.botPermissions.has(Permissions.FLAGS.MANAGE_MESSAGES)) {
				this.client.setTimeout(() => {
					if (this.shouldReplyInSameChannel) return;
					this.delete().catch(logger.error);
				}, 10_000);
			}

			const readableRequiredChannelPermissions = new Permissions(requiredChannelPermissions)
				.toArray()
				.map(permission => `'${permission}'`);
			const errorMessage = commaListsAnd`no #bot-commands channel with the required permission${readableRequiredChannelPermissions.length === 1 ? '' : 's'} ${readableRequiredChannelPermissions} found`;

			logger.error(errorMessage);

			this.author
				.send(stripIndents`
					${errorMessage}.
					Use \`${this.content} -c\` if you want the reply in ${this.channel} instead.
				`)
				.catch(() => logger.error(`[REPLY]: unable to DM ${this.author.tag} | ${this.member.displayName}`));

			return null;
		}

		// clean up channel after 10s
		if (this.sendReplyChannel) { // notify author and delete messages
			super
				.reply(`${commandsChannel}. Use \`${this.content} -c\` if you want the reply in ${this.channel} instead.`)
				.then(async (commandsChannelMessage) => {
					if (!this.channel.botPermissions.has(Permissions.FLAGS.MANAGE_MESSAGES)) return commandsChannelMessage.delete({ timeout: 10_000 });

					this.client.setTimeout(() => {
						if (!this.channel.botPermissions.has(Permissions.FLAGS.MANAGE_MESSAGES) || this.shouldReplyInSameChannel) return commandsChannelMessage.delete();

						this.channel
							.bulkDelete([ commandsChannelMessage.id, this.id ])
							.catch(error => logger.error('[REPLY]: unable to bulk delete', error));
					}, 10_000);
				});
		} else if (this.channel.botPermissions.has(Permissions.FLAGS.MANAGE_MESSAGES)) { // only delete author's message
			this.client.setTimeout(() => {
				if (this.shouldReplyInSameChannel) return;
				this.delete().catch(logger.error);
			}, 10_000);
		}

		// send reply with an @mention
		return this._sendReply(
			`\u{200b}${this.author}${content.length ? `, ${content}` : ''}`,
			options,
			commandsChannel,
		);
	}

	/**
	 * send a reply in the provided channel and saves the IDs of that reply message
	 * @param {?string} content
	 * @param {?MessageReplyOptions} [options={}]
	 * @param {import('./TextChannel')} [channel=this.channel]
	 */
	async _sendReply(content, options = {}, channel = this.channel) {
		// determine reply ID and IDs to delete
		const replyData = await this.replyData;

		let oldReplyMessageID;
		let IDsToDelete;

		if (replyData) {
			if (Array.isArray(replyData.messageID)) {
				[ oldReplyMessageID, ...IDsToDelete ] = replyData.messageID;
			} else {
				oldReplyMessageID = replyData.messageID;
			}
		}

		let message;

		if (options?.split) { // send multiple messages
			if (oldReplyMessageID && options.editPreviousMessage) {
				IDsToDelete ??= [];
				IDsToDelete.push(oldReplyMessageID);
			}

			message = await channel.send(content, options);

			if (options.saveReplyMessageID) {
				this.replyData = {
					channelID: message[0].channel.id,
					messageID: message.map(({ id }) => id),
				};
			}
		} else { // send 1 message
			message = await (oldReplyMessageID && options.editPreviousMessage
				? ((await channel.messages.fetch(oldReplyMessageID).catch(error => logger.error('[_SEND REPLY]', error)))?.edit(content, options) ?? channel.send(content, options))
				: channel.send(content, options));

			if (options.saveReplyMessageID) {
				this.replyData = {
					channelID: message.channel.id,
					messageID: message.id,
				};
			}
		}

		// cleanup channel (delete old replies)
		if (IDsToDelete?.length && replyData.channelID) {
			this.client.channels.cache.get(replyData.channelID)
				?.deleteMessages(IDsToDelete)
				.catch(error => logger.error(`[_SEND REPLY]: IDs: ${IDsToDelete.map(x => `'${x}'`).join(', ')}`, error));
		}

		return message;
	}

	/**
	 * edits a message, preserving @mention pings at the beginning
	 */
	async edit(content, options) {
		if (typeof content !== 'string') return super.edit(content, options);

		const pingMatched = this.content?.match(replyPingRegExp);

		return super.edit(
			pingMatched && !content.startsWith(pingMatched[0])
				? `${pingMatched[0]}${content}`
				: content,
			options,
		);
	}
}

Structures.extend(basename(__filename, '.js'), () => LunarMessage);

module.exports = LunarMessage;
