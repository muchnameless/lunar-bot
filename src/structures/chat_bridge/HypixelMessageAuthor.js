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

	get player() {
		return this.chatBridge.client.players.cache.find(player => player.ign === this.ign);
	}

	/**
	 * whisper a message to the author
	 * @param {string} message
	 */
	async send(message) {
		return this.chatBridge.chat(message, `/w ${this.ign}`);
	}
}

module.exports = HypixelMessageAuthor;
