'use strict';

const { Structures, User } = require('discord.js');
const logger = require('../../functions/logger');


class LunarUser extends User {
	constructor(...args) {
		super(...args);

		/**
		 * @type {import('../LunarClient')}
		 */
		this.client;
	}

	/**
	 * player object associated with the discord user
	 */
	get player() {
		return this.client.players.getByID(this.id);
	}
}

Structures.extend('User', User => LunarUser); // eslint-disable-line no-shadow, no-unused-vars

module.exports = LunarUser;
