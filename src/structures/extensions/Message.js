'use strict';

const { commaListsAnd } = require('common-tags');
const { Structures, MessageEmbed, Message, User, Util: { splitMessage } } = require('discord.js');
const { multiCache } = require('../../api/cache');
const _ = require('lodash');
const LunarGuildMember = require('./GuildMember');
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

	/**
	 * wether the command was send by a non-bot user account
	 */
	get isUserMessage() {
		return !this.author.bot && !this.webhookID && !this.system;
	}

	/**
	 * scans the message.content for a 'channel' flag
	 */
	get shouldReplyInSameChannel() {
		return this.channel.isTicket
			|| (this.content
				?.split(/ +/)
				.filter(x => x.startsWith('-'))
				.some(x => [ 'c', 'ch', 'channel' ].includes(x.toLowerCase().replace(/^-+/, '')))
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
		return multiCache.get(`reply_${this.guild?.id ?? 'DM'}_${this.channel.id}_${this.id}`);
	}

	/**
	 * caches the reply data for 1 hour
	 * @param {ReplyData} input
	 */
	set replyData({ channelID, messageID }) {
		multiCache.set(
			`reply_${this.guild?.id ?? 'DM'}_${this.channel.id}_${this.id}`,
			{
				channelID,
				messageID,
			},
			{
				ttl: 30 * 60, // 30 min
			},
		);
	}

	/**
	 * returns the nearest 'bot-commands'-channel with all required permissions for the bot and the message.member
	 * @param {string[]} requiredChannelPermissions
	 * @returns {import('./TextChannel')}
	 */
	findNearestCommandsChannel(requiredChannelPermissions = [ 'VIEW_CHANNEL', 'SEND_MESSAGES' ]) {
		if (!this.guild) return null;

		return this.channel.parent.children.find(channel => channel.name.includes('commands') && channel.permissionsFor(this.guild.me).has(requiredChannelPermissions) && channel.permissionsFor(this.member).has([ 'VIEW_CHANNEL', 'SEND_MESSAGES' ]))
			?? this.guild.channels.cache.find(channel => channel.name.includes('bot-commands') && channel.permissionsFor(this.guild.me).has(requiredChannelPermissions) && channel.permissionsFor(this.member).has([ 'VIEW_CHANNEL', 'SEND_MESSAGES' ]));
	}

	/**
	 * message.react with deleted and permission check and promise rejection catch
	 * @param {import('discord.js').EmojiResolvable} emoji
	 * @returns {Promise<?MessageReaction>}
	 */
	async reactSafely(emoji) {
		if (this.deleted) return null;
		if (!this.channel.checkBotPermissions('ADD_REACTIONS')) return null;
		return super.react(emoji).catch(error => logger.error(`[REACT SAFELY]: ${error.name}: ${error.message}`));
	}

	/**
	 * delete the message, added check for already deleted after timeout
	 * @param {object} options message delete options
	 * @param {number} [options.timeout] delay in ms
	 * @param {string} [options.reason] reason for discord's audit logs
	 */
	async delete(options = {}) {
		if (typeof options !== 'object') throw new TypeError('INVALID_TYPE', 'options', 'object', true);

		const { timeout = 0, reason } = options;

		// message already deleted check
		if (this.deleted) return this;

		// permission check
		if (this.author.id !== this.client.user.id && !this.channel.permissionsFor?.(this.guild?.me).has('MANAGE_MESSAGES')) {
			logger.warn(`[MESSAGE DELETE]: missing permission to delete message from ${this.author.tag} in ${this.channel.name}`);
			return this;
		}

		// no timeout
		if (timeout <= 0) return this.channel.messages.delete(this.id, reason).then(() => this);

		// timeout
		return this.client.setTimeout(() => {
			if (this.deleted) return this;
			return this.delete({ reason });
		}, timeout);
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

		let content;

		// only object as first arg provided
		if (typeof contentInput === 'object') {
			if (contentInput instanceof MessageEmbed || !_.isEqual(new MessageEmbed(), new MessageEmbed(contentInput))) {
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
		options.embed ??= _.isEqual(new MessageEmbed(), new MessageEmbed(options))
			? null
			: options;

		options.saveReplyMessageID ??= true;

		// DMs
		if (!this.guild) return this._sendReply(content, options);

		// add reply if it is not present
		options.reply ??= this.author.id;

		if (options.reply && typeof options.reply !== 'string') {
			if (options.reply instanceof User || options.reply instanceof LunarGuildMember) {
				options.reply = options.reply.id;
			} else if (options.reply instanceof LunarMessage) {
				options.reply = options.reply.author.id;
			}
		}

		options.sameChannel ??= false;

		// if (options.reply) content = `\u200b<@${options.reply}>${content.length ? ', ' : ''}${content}`;

		// guild -> requires permission
		const requiredChannelPermissions = [ 'VIEW_CHANNEL', 'SEND_MESSAGES' ];

		if (options.embed) {
			requiredChannelPermissions.push('EMBED_LINKS');
			if (options.embed.files?.length) requiredChannelPermissions.push('ATTACH_FILES');
		}

		const hypixelGuild = this.client.hypixelGuilds.cache.find(({ chatBridgeChannelID }) => chatBridgeChannelID === this.channel.id);

		// commands channel / reply in same channel option or flag
		if (this.channel.name.includes('commands') || options.sameChannel || this.shouldReplyInSameChannel || hypixelGuild) {
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

			try {
				hypixelGuild?.chatBridge.gchat(content);
			} catch (error) {
				logger.error(`[REPLY]: ${error.message}`);
			}

			// send reply
			return this._sendReply(content, options);
		}

		// redirect reply to nearest #bot-commands channel
		const commandsChannel = this.findNearestCommandsChannel(requiredChannelPermissions);

		// no #bot-commands channel found
		if (!commandsChannel) {
			if (this.channel.permissionsFor(this.guild.me).has('MANAGE_MESSAGES')) {
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
					if (!this.channel.permissionsFor(this.guild.me).has('MANAGE_MESSAGES'))	return commandsChannelMessage.delete({ timeout: 10_000 });

					this.client.setTimeout(() => {
						if (!this.channel.permissionsFor(this.guild.me).has('MANAGE_MESSAGES') || this.shouldReplyInSameChannel) return commandsChannelMessage.delete();

						this.channel
							.bulkDelete([ commandsChannelMessage.id, this.id ])
							.catch(error => logger.error(`[REPLY]: unable to bulk delete: ${error.name}: ${error.message}`));
					}, 10_000);
				});
		} else if (this.channel.permissionsFor(this.guild.me).has('MANAGE_MESSAGES')) { // only delete author's message
			this.client.setTimeout(() => {
				if (this.shouldReplyInSameChannel) return;
				this.delete().catch(logger.error);
			}, 10_000);
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

		if (options?.split && splitMessage(content, options.split).length > 1) { // send multiple messages
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
				? ((await channel.messages.fetch(oldReplyMessageID).catch(error => logger.error(`[SEND REPLY]: ${error.name}: ${error.message}`)))?.edit(content, options) ?? channel.send(content, options))
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
				.catch(error => logger.error(`[SEND REPLY]: IDs: ${IDsToDelete.map(x => `'${x}'`).join(', ')}: ${error.name}: ${error.message}`));
		}

		return message;
	}
}

Structures.extend('Message', Message => LunarMessage); // eslint-disable-line no-shadow, no-unused-vars

module.exports = LunarMessage;
