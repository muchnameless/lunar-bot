'use strict';

const logger = require('../functions/logger');


module.exports = class UserUtil extends null {
	/**
	 * @type {WeakMap<import('discord.js').User, import('../structures/database/models/Player')>}
	 */
	static PLAYER_CACHE = new WeakMap();

	/**
	 * @param {import('discord.js').User} user
	 */
	static getPlayer(user) {
		/** @type {?import('../structures/database/models/Player')} */
		let player = this.PLAYER_CACHE.get(user);
		if (player) return player;

		player = user.client.players.getById(user.id) ?? user.client.players.getById(user.tag);
		if (player) this.setPlayer(user, player);
		return player;
	}

	/**
	 * @param {import('discord.js').User} user
	 * @param {import('../structures/database/models/Player')} player
	 */
	static setPlayer(user, player) {
		if (player == null) return this.PLAYER_CACHE.delete(user);

		this.PLAYER_CACHE.set(user, player);
	}

	/**
	 * @param {import('discord.js').User} user
	 * @param {string | import('discord.js').MessageOptions} contentOrOptions
	 */
	static async sendDM(user, contentOrOptions) {
		if (user.bot) return logger.warn(`${user.tag} is a bot and can't be DMed`);

		try {
			return await user.send(contentOrOptions);
		} catch (error) {
			return logger.error(error);
		}
	}
};
