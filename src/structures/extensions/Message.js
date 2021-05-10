'use strict';

const { commaListsAnd } = require('common-tags');
const { Structures, MessageEmbed, Message, Permissions } = require('discord.js');
const { isEqual } = require('lodash');
const { CHANNEL_FLAGS } = require('../../constants/bot');
const { DM_KEY, REPLY_KEY } = require('../../constants/redis');
const cache = require('../../api/cache');
const logger = require('../../functions/logger');


class LunarMessage extends Message {
	constructor(...args) {
		super(...args);

		this.sendReplyChannel = true;

		/**
		 * @type {import('./User')}
		 */
		this.author;
		/**
		 * @type {import('../LunarClient')}
		 */
		this.client;
	}

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
	findNearestCommandsChannel(requiredChannelPermissions = [ Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES ]) {
		if (!this.guild) return null;

		return this.channel.parent.children.find((/** @type {import('./TextChannel')} */ channel) => channel.name.includes('commands')
			&& channel.permissionsFor(this.guild.me).has(requiredChannelPermissions)
			&& channel.permissionsFor(this.member).has([ Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES ]),
		)
			?? this.guild.channels.cache
				.filter((/** @type {import('./TextChannel')} */ channel) => channel.name.includes('commands')
					&& channel.permissionsFor(this.guild.me).has(requiredChannelPermissions)
					&& channel.permissionsFor(this.member).has([ Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES ]),
				)
				.sort((a, b) => Math.abs(a.rawPosition - this.channel.rawPosition) - Math.abs(b.rawPosition - this.channel.rawPosition))
				.first();
	}

	/**
	 * message.react with deleted and permission check and promise rejection catch
	 * @param {import('discord.js').EmojiResolvable} emoji
	 * @returns {Promise<?import('discord.js').MessageReaction>}
	 */
	async reactSafely(emoji) {
		if (this.deleted) return null;
		if (!this.channel.checkBotPermissions(Permissions.FLAGS.ADD_REACTIONS)) return null;
		if (this.reactions.cache.get(this.client.emojis.resolveID(emoji))?.me) return Promise.resolve(this.reactions.cache.get(this.client.emojis.resolveID(emoji)));
		return super.react(emoji).catch(error => logger.error(`[REACT SAFELY]: ${error}`));
	}

	/**
	 * delete the message, added check for already deleted after timeout
	 * @param {object} options message delete options
	 * @param {number} [options.timeout] delay in ms
	 */
	async delete({ timeout = 0 } = {}) {
		if (this.deleted) return this; // message already deleted check

		if (!this.deletable) { // permission check
			logger.warn(`[MESSAGE DELETE]: missing permission to delete message from ${this.author.tag} in ${this.channel.name}`);
			return this;
		}

		// no timeout
		if (timeout <= 0) return super.delete();

		// timeout
		return this.client.setTimeout(() => this.delete(), timeout);
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
	 * @typedef {import('discord.js').MessageOptions} MessageReplyOptions
	 * @property {boolean} [sameChannel=false]
	 * @property {boolean} [sendReplyChannel=true]
	 * @property {boolean} [saveReplyMessageID=true]
	 */

	/**
	 * replies in nearest #bot-commands or in message's channel if DMs or '-c' flag set
	 * @param {string} contentInput message reply content
	 * @param {MessageReplyOptions} [optionsInput] message reply options
	 * @returns {Promise<?LunarMessage>}
	 */
	async reply(contentInput, optionsInput = {}) {
		// analyze input and create (content, options)-argument
		if (typeof contentInput === 'undefined') throw new TypeError('content must be defined');
		if (typeof optionsInput !== 'object' || optionsInput === null) throw new TypeError('options must be an Object');

		const options = { ...optionsInput };

		/** @type {string} */
		let content;

		// only object as first arg provided
		if (typeof contentInput === 'object') {
			if (contentInput instanceof MessageEmbed || !isEqual(new MessageEmbed(), new MessageEmbed(contentInput))) {
				options.embed = contentInput;
				content = '';
			} else if (!Array.isArray(contentInput)) { // unknown options object
				content = contentInput.content ?? '';
			} else {
				content = contentInput;
			}
		} else {
			content = contentInput;
		}

		// add embed structure generated from options if it is an embed but not from the default constructor
		options.embed ??= isEqual(new MessageEmbed(), new MessageEmbed(options))
			? null
			: options;

		options.saveReplyMessageID ??= true;

		// DMs
		if (!this.guild) return this._sendReply(content, { replyTo: this.id, ...options });

		options.sameChannel ??= false;

		// if (options.reply) content = `\u200b<@${options.reply}>${content.length ? ', ' : ''}${content}`;

		// guild -> requires permission
		const requiredChannelPermissions = [ Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES ];

		if (options.embed) {
			requiredChannelPermissions.push('EMBED_LINKS');
			if (options.embed.files?.length) requiredChannelPermissions.push('ATTACH_FILES');
		}

		// commands channel / reply in same channel option or flag
		if (this.channel.name.includes('commands') || options.sameChannel || this.shouldReplyInSameChannel) {
			// permission checks
			if (!this.channel.permissionsFor(this.guild.me).has(requiredChannelPermissions)) {
				const missingChannelPermissions = requiredChannelPermissions.filter(permission => !this.channel.permissionsFor(this.guild.me).has(permission));

				logger.warn(`missing ${missingChannelPermissions.map(permission => `'${permission}'`)} permission${missingChannelPermissions.length === 1 ? '' : 's'} in #${this.channel.name}`);

				this.author
					.send(commaListsAnd`
						missing ${missingChannelPermissions.map(permission => `\`${permission}\``)} permission${missingChannelPermissions.length === 1 ? '' : 's'} in #${this.channel}
					`)
					.catch(() => logger.error(`[REPLY]: unable to DM ${this.author.tag} | ${this.member.displayName}`));

				return null;
			}

			this.client.chatBridges.handleDiscordMessage(this, { checkifNotFromBot: false });

			// send reply
			const message = await this._sendReply(content, { replyTo: this.id, ...options });

			if (content.length) this.client.chatBridges.handleDiscordMessage(message, { checkifNotFromBot: false, player: this.author.player });

			return message;
		}

		// redirect reply to nearest #bot-commands channel
		const commandsChannel = this.findNearestCommandsChannel(requiredChannelPermissions);

		// no #bot-commands channel found
		if (!commandsChannel) {
			if (this.channel.permissionsFor(this.guild.me).has(Permissions.FLAGS.MANAGE_MESSAGES)) {
				this.client.setTimeout(() => {
					if (this.shouldReplyInSameChannel) return;
					this.delete().catch(logger.error);
				}, 10_000);
			}

			logger.warn(commaListsAnd`no #bot-commands channel with the required permission${requiredChannelPermissions.length === 1 ? '' : 's'} ${requiredChannelPermissions.map(permission => `'${permission}'`)}`);

			this.author
				.send(commaListsAnd`
					no #bot-commands channel with the required permission${requiredChannelPermissions.length === 1 ? '' : 's'} ${requiredChannelPermissions.map(permission => `\`${permission}\``)} found.
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
					if (!this.channel.permissionsFor(this.guild.me).has(Permissions.FLAGS.MANAGE_MESSAGES))	return commandsChannelMessage.delete({ timeout: 10_000 });

					this.client.setTimeout(() => {
						if (!this.channel.permissionsFor(this.guild.me).has(Permissions.FLAGS.MANAGE_MESSAGES) || this.shouldReplyInSameChannel) return commandsChannelMessage.delete();

						this.channel
							.bulkDelete([ commandsChannelMessage.id, this.id ])
							.catch(error => logger.error(`[REPLY]: unable to bulk delete: ${error}`));
					}, 10_000);
				});
		} else if (this.channel.permissionsFor(this.guild.me).has(Permissions.FLAGS.MANAGE_MESSAGES)) { // only delete author's message
			this.client.setTimeout(() => {
				if (this.shouldReplyInSameChannel) return;
				this.delete().catch(logger.error);
			}, 10_000);
		}

		// add reply if it is not present
		if (options.replyTo !== false) {
			content = `\u{200b}${this.author}${content.length ? `, ${content}` : ''}`;
		}

		// send reply
		return this._sendReply(content, options, commandsChannel);
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
			if (oldReplyMessageID) {
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
			message = await (oldReplyMessageID
				? ((await channel.messages.fetch(oldReplyMessageID).catch(error => logger.error(`[SEND REPLY]: ${error}`)))?.edit(content, options) ?? channel.send(content, options))
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
				.catch(error => logger.error(`[SEND REPLY]: IDs: ${IDsToDelete.map(x => `'${x}'`).join(', ')}: ${error}`));
		}

		return message;
	}
}

Structures.extend('Message', () => LunarMessage);

module.exports = LunarMessage;
