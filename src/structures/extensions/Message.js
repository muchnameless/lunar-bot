'use strict';

const { commaListsAnd } = require('common-tags');
const { Structures, MessageEmbed, Message, User } = require('discord.js');
const _ = require('lodash');
const LunarGuildMember = require('./GuildMember');
const logger = require('../../functions/logger');


class LunarMessage extends Message {
	constructor(...args) {
		super(...args);

		this.shouldSendReplyChannel = true;
		this.replyMessageID = null;
	}

	/**
	 * scans the message.content for a 'channel' flag
	 */
	get shouldReplyInSameChannel() {
		return this.content?.split(/ +/).filter(x => x.startsWith('-')).some(x => [ 'c', 'ch', 'channel' ].includes(x.toLowerCase().replace(/^-+/, ''))) ?? false;
	}

	/**
	 * returns the nearest 'bot-commands'-channel with all required permissions for the bot and the message.member
	 * @param {string[]} requiredChannelPermissions
	 */
	findNearestCommandsChannel(requiredChannelPermissions = [ 'VIEW_CHANNEL', 'SEND_MESSAGES' ]) {
		return this.channel.parent.children.find(channel => channel.name.includes('commands') && channel.permissionsFor(this.guild.me).has(requiredChannelPermissions) && channel.permissionsFor(this.member).has([ 'VIEW_CHANNEL', 'SEND_MESSAGES' ]))
			?? this.guild.channels.cache.find(channel => channel.name.includes('bot-commands') && channel.permissionsFor(this.guild.me).has(requiredChannelPermissions) && channel.permissionsFor(this.member).has([ 'VIEW_CHANNEL', 'SEND_MESSAGES' ]));
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
			const questionMessage = await this.reply(question, options);

			if (!questionMessage) return null;

			this.replyMessageID = null; // to not overwride the question message
			this.shouldSendReplyChannel = false; // to not ping the author with #bot-commands a second time

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
	 * replies in nearest #bot-commands or in message's channel if DMs or '-c' flag set
	 * @param {string} content message reply content
	 * @param {object} options message reply options
	 */
	async reply(content, options = {}) {
		// analyze input and create (content, options)-argument
		if (typeof content == undefined) throw new TypeError('content must be defined');
		if (typeof options !== 'object' || options === null) throw new TypeError('options must be an Object');

		// only object as first arg provided
		if (typeof content === 'object') {
			if (content instanceof MessageEmbed) {
				options.embed = content;
				content = '';
			} else if (!Array.isArray(content)) { // unknown options object
				options = content;
				content = options.content ?? '';
			}
		}

		// add embed structure generated from options if it is an embed but not from the default constructor
		options.embed ??= _.isEqual(new MessageEmbed(), new MessageEmbed(options))
			? null
			: options;

		// DMs
		if (!this.guild) {
			return this.replyMessageID && this.channel.messages.cache.has(this.replyMessageID)
				? this.channel.messages.cache.get(this.replyMessageID).edit(content, options)
				: this.channel.send(content, options)
					.then(message => {
						this.replyMessageID = message.id;
						return message;
					});
		}

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

		if (options.embed) requiredChannelPermissions.push('EMBED_LINKS');

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
					.catch(() => logger.error(`[SEND CORRECT CHANNEL]: unable to DM ${this.author.tag} | ${this.member.displayName}`));

				return null;
			}

			// send reply
			return this.replyMessageID && this.channel.messages.cache.has(this.replyMessageID)
				? this.channel.messages.cache.get(this.replyMessageID).edit(content, options)
				: this.channel.send(content, options)
					.then(message => {
						this.replyMessageID = message.id;
						return message;
					});
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
				.catch(() => logger.error(`[SEND CORRECT CHANNEL]: unable to DM ${this.author.tag} | ${this.member.displayName}`));

			return null;
		}

		// clean up channel after 10s
		if (this.shouldSendReplyChannel) { // notify author and delete messages
			super
				.reply(`${commandsChannel}. Use \`${this.content} -c\` if you want the reply in ${this.channel} instead.`)
				.then(async commandsChannelMessage => {
					if (!this.channel.permissionsFor(this.guild.me).has('MANAGE_MESSAGES'))
						return commandsChannelMessage.delete({ timeout: 10_000 });

					this.client.setTimeout(() => {
						if (!this.channel.permissionsFor(this.guild.me).has('MANAGE_MESSAGES') || this.shouldReplyInSameChannel)
							return commandsChannelMessage.delete();

						this.channel
							.bulkDelete([ commandsChannelMessage.id, this.id ])
							.catch(error => logger.error(`[SEND CORRECT CHANNEL]: unable to bulk delete: ${error.name}: ${error.message}`));
					}, 10_000);
				});
		} else if (this.channel.permissionsFor(this.guild.me).has('MANAGE_MESSAGES')) { // only delete author's message
			this.client.setTimeout(() => {
				if (this.shouldReplyInSameChannel) return;
				this.delete().catch(logger.error);
			}, 10_000);
		}

		// send reply
		return this.replyMessageID && commandsChannel.messages.cache.has(this.replyMessageID)
			? commandsChannel.messages.cache.get(this.replyMessageID).edit(content, options)
			: commandsChannel.send(content, options);
	}
}

Structures.extend('Message', Message => LunarMessage); // eslint-disable-line no-shadow, no-unused-vars

module.exports = LunarMessage;
