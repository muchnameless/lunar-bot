'use strict';

const { Structures, DMChannel, Permissions } = require('discord.js');
// const logger = require('../../functions/logger');


class LunarDMChannel extends DMChannel {
	/**
	 * wether the channel is a ticket by yagpdb
	 */
	// eslint-disable-next-line class-methods-use-this
	get isTicket() {
		return false;
	}

	/**
	 * checks wether the bot has the provided permission(s) in the channel
	 * @param {BigInt|BigInt[]} permFlag
	 */
	checkBotPermissions(permFlag) {
		if (Array.isArray(permFlag)) return permFlag.every(flag => this.checkBotPermissions(flag));

		switch (permFlag) {
			case Permissions.FLAGS.ADD_REACTIONS: // add new reactions to messages
			case Permissions.FLAGS.VIEW_CHANNEL:
			case Permissions.FLAGS.SEND_MESSAGES:
			case Permissions.FLAGS.SEND_TTS_MESSAGES:
			case Permissions.FLAGS.EMBED_LINKS: // links posted will have a preview embedded
			case Permissions.FLAGS.ATTACH_FILES:
			case Permissions.FLAGS.READ_MESSAGE_HISTORY: // view messages that were posted prior to opening Discord
			case Permissions.FLAGS.MENTION_EVERYONE:
			case Permissions.FLAGS.USE_EXTERNAL_EMOJIS: // use emojis from different guilds
				return true;

			default:
				return false;
		}
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

Structures.extend('DMChannel', () => LunarDMChannel);

module.exports = LunarDMChannel;
