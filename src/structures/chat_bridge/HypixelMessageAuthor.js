'use strict';


class HypixelMessageAuthor {
	/**
	 * @param {import('./ChatBridge')} chatBridge
	 * @param {object} param1
	 * @param {string} [param1.hypixelRank]
	 * @param {string} [param1.ign]
	 * @param {string} [param1.guildRank]
	 */
	constructor(chatBridge, { hypixelRank, ign, guildRank }) {
		this.chatBridge = chatBridge;
		this.hypixelRank = hypixelRank ?? null;
		this.ign = ign ?? null;
		this.guildRank = guildRank ?? null;
	}

	/**
	 * wether the message author is in the guild player db
	 */
	get inGuild() {
		return this.chatBridge.client.players.cache.some(({ ign }) => ign === this.ign);
	}

	/**
	 * the message author's player object
	 */
	get player() {
		return this.chatBridge.client.players.findByIGN(this.ign);
	}

	/**
	 * whisper a message to the author
	 * @param {string} message
	 * @param {?import('./ChatBridge').ChatOptions} options
	 */
	async send(message, { prefix = '', ...options } = {}) {
		return this.chatBridge.chat(message, { prefix: `/w ${this.ign} ${prefix}${prefix.length ? ' ' : ''}`, ...options });
	}
}

module.exports = HypixelMessageAuthor;
