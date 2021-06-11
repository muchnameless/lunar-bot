'use strict';

const { basename } = require('path');
const { Structures, User } = require('discord.js');
// const logger = require('../../functions/logger');


class LunarUser extends User {
	constructor(...args) {
		super(...args);

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
	 * player object associated with the discord user
	 */
	set player(value) {
		this._player = value;
	}

	/**
	 * hypixelGuild object associated with the discord user
	 */
	get hypixelGuild() {
		return this.player?.guild ?? null;
	}

	/**
	 * Creates a DM channel between the client and this user if the user is not a bot
	 * @param {boolean} [force=false]
	 */
	async createDM(force) {
		if (this.bot) throw new Error(`${this.tag} is a bot and can't be DMed`);
		return super.createDM(force);
	}
}

Structures.extend(basename(__filename, '.js'), () => LunarUser);

module.exports = LunarUser;
