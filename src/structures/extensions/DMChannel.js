'use strict';

const { Structures, DMChannel } = require('discord.js');
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
	 * @param {string|string[]} permFlag
	 */
	checkBotPermissions(permFlag) {
		if (Array.isArray(permFlag)) return permFlag.every(flag => this.checkBotPermissions(flag));
		if (typeof permFlag !== 'string') throw new TypeError('permFlag must be either a string or an Array of strings');

		switch (permFlag) {
			case 'ADD_REACTIONS': // add new reactions to messages
			case 'VIEW_CHANNEL':
			case 'SEND_MESSAGES':
			case 'SEND_TTS_MESSAGES':
			case 'EMBED_LINKS': // links posted will have a preview embedded
			case 'ATTACH_FILES':
			case 'READ_MESSAGE_HISTORY': // view messages that were posted prior to opening Discord
			case 'MENTION_EVERYONE':
			case 'USE_EXTERNAL_EMOJIS': // use emojis from different guilds
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
