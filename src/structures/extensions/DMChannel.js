'use strict';

const { Structures, Permissions } = require('discord.js');
// const logger = require('../../functions/logger');


class LunarDMChannel extends Structures.get('DMChannel') {
	static BOT_PERMISSIONS = new Permissions();

	// eslint-disable-next-line class-methods-use-this
	get botPermissions() {
		return LunarDMChannel.BOT_PERMISSIONS;
	}

	/**
	 * wether the channel is a ticket by yagpdb
	 */
	// eslint-disable-next-line class-methods-use-this
	get isTicket() {
		return false;
	}

	/**
	 * deletes all provided messages from the channel with as few API calls as possible
	 * @param {string|string[]} IDs
	 */
	deleteMessages(IDs) {
		if (Array.isArray(IDs)) return Promise.all(IDs.map(async id => this.messages.delete(id)));

		return this.messages.delete(IDs);
	}
}

LunarDMChannel.BOT_PERMISSIONS
	.add([
		Permissions.FLAGS.ADD_REACTIONS,
		Permissions.FLAGS.VIEW_CHANNEL,
		Permissions.FLAGS.SEND_MESSAGES,
		Permissions.FLAGS.SEND_TTS_MESSAGES,
		Permissions.FLAGS.EMBED_LINKS,
		Permissions.FLAGS.ATTACH_FILES,
		Permissions.FLAGS.READ_MESSAGE_HISTORY,
		Permissions.FLAGS.MENTION_EVERYONE,
		Permissions.FLAGS.USE_EXTERNAL_EMOJIS,
	])
	.freeze();

Structures.extend('DMChannel', () => LunarDMChannel);

module.exports = LunarDMChannel;
