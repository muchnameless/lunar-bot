'use strict';

const HypixelMessageAuthor = require('./HypixelMessageAuthor');

/**
 * @typedef {object} TextComponent
 * @property {object} json
 * @property {string} text
 * @property {any[]} extra
 * @property {*} bold
 * @property {*} italic
 * @property {*} underlined
 * @property {*} strikethrough
 * @property {*} obfuscated
 * @property {string} color
 */

/**
 * @typedef {string} ChatPosition
 * * `chat`
 * * `system`
 * * `game_info`
 */

/**
 * @typedef {string} HypixelMessageType
 * * `guild`
 * * `party`
 * * `whisper`
 */


class HypixelMessage {
	/**
	 * @param {import('./ChatBridge')} chatBridge
	 * @param {TextComponent[]} jsonMessage
	 * @param {ChatPosition} position
	 */
	constructor(chatBridge, jsonMessage, position) {
		this.chatBridge = chatBridge;
		this.jsonMessage = jsonMessage;
		this.position = position;
		this.rawContent = jsonMessage.toString().trim();

		const messageParts = this.rawContent.split(':');

		/**
		 * Guild > [HypixelRank] ign [GuildRank]
		 * From [HypixelRank] ign
		 */
		const matched = messageParts.shift().replace(/§[0-9a-gk-or]/g, '').trim().match(/^(?:(?<type>Guild|Party) > |(?<whisper>From) )(?:\[(?<hypixelRank>.+)\] )?(?<ign>\w+)(?: \[(?<guildRank>\w+)\])?/);

		if (matched) {
			this.author = new HypixelMessageAuthor(this.chatBridge, {
				hypixelRank: matched.groups.hypixelRank,
				ign: matched.groups.ign,
				guildRank: matched.groups.guildRank,
			});
			this.type = matched.groups.type?.toLowerCase() ?? (matched.groups.whisper ? 'whisper' : null);
			this.content = messageParts.join(':').replace(/ࠀ|⭍/g, '').trim();
		} else {
			this.author = null;
			this.type = null;
			this.content = this.rawContent;
		}
	}

	/**
	 * replies ingame to the message
	 * @param {string} message
	 */
	async reply(message) {
		switch (this.type) {
			case 'guild':
				return this.chatBridge.gchat(message);

			case 'party':
				return this.chatBridge.pchat(message);

			case 'whisper':
				return this.author.send(message);

			default:
				throw new Error('unknown type to reply to');
		}
	}
}

module.exports = HypixelMessage;
