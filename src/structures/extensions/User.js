'use strict';

const { Structures, User } = require('discord.js');
// const logger = require('../../functions/logger');


class LunarUser extends User {
	constructor(...args) {
		super(...args);

		/**
		 * @type {import('../LunarClient')}
		 */
		this.client;
		/**
		 * @type {import('../database/models/Player')}
		 */
		this._player = null;
	}

	/**
	 * player object associated with the discord user
	 */
	get player() {
		return this._player ??= this.client.players.getByID(this.id);
	}

	/**
	 * hypixelGuild object associated with the discord user
	 */
	get hypixelGuild() {
		return this.player?.guild ?? null;
	}
}

Structures.extend('User', User => LunarUser); // eslint-disable-line no-shadow, no-unused-vars

module.exports = LunarUser;
