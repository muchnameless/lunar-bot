'use strict';

const mojang = require('../../api/mojang');
const logger = require('../../functions/logger');


module.exports = class HypixelMessageAuthor {
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

		/**
		 * @type {?import('../database/models/Player')}
		 */
		this.player = null;
		/**
		 * @type {?import('../extensions/GuildMember')}
		 */
		this.member = null;
	}

	get client() {
		return this.chatBridge.client;
	}

	/**
	 * set player and member
	 */
	async init() {
		// check if player with that ign is in the db
		const player = this.client.players.findByIGN(this.ign);

		if (player) {
			this.player = player;
			this.member = await player.discordMember;
			return;
		}

		// check mojang (API/cache) for the uuid associated with that ign
		try {
			const { uuid } = await mojang.ign(this.ign);
			this.player = this.client.players.cache.get(uuid) ?? null;
			this.member = await this.player?.discordMember;
		} catch (error) {
			logger.error(`[AUTHOR PLAYER]: ${error}`);
		}
	}

	/**
	 * whisper a message to the author
	 * @param {string} message
	 * @param {?import('./ChatBridge').ChatOptions} options
	 */
	async send(message, { prefix = '', ...options } = {}) {
		return this.chatBridge.chat(message, { prefix: `/w ${this.ign} ${prefix}${prefix.length ? ' ' : ''}`, ...options });
	}
};
