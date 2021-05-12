'use strict';

const mojang = require('../../api/mojang');
const logger = require('../../functions/logger');


module.exports = class HypixelMessageAuthor {
	/**
	 * @param {import('./ChatBridge')} chatBridge
	 * @param {object} param1
	 * @param {string} [param1.ign]
	 * @param {string} [param1.guildRank]
	 * @param {string} [param1.uuid]
	 */
	constructor(chatBridge, { ign, guildRank, uuid }) {
		this.chatBridge = chatBridge;
		this.ign = ign ?? null;
		this.guildRank = guildRank ?? null;

		/**
		 * player object of the message author
		 */
		this.player = uuid
			? this.client.players.cache.get(uuid)
			: this.client.players.findByIGN(ign);
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
		try {
			if (!this.player) {
				// check mojang API / cache for the uuid associated with that ign
				const { uuid } = await mojang.ign(this.ign);
				this.player = this.client.players.cache.get(uuid) ?? null;
			}

			this.member = await this.player?.discordMember;
		} catch (error) {
			logger.error('[AUTHOR PLAYER]', error);
		}
	}

	/**
	 * whisper a message to the author
	 * @param {string} message
	 * @param {?import('./ChatBridge').ChatOptions} options
	 */
	async send(message, { prefix = '', ...options } = {}) {
		return this.chatBridge.minecraft.chat(message, { prefix: `/w ${this.ign} ${prefix}${prefix.length ? ' ' : ''}`, ...options });
	}
};
