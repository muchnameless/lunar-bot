'use strict';

const { Structures } = require('discord.js');
// const logger = require('../../functions/logger');


class LunarThreadMember extends Structures.get('ThreadMember') {
	/**
	 * player object associated with the discord member
	 * @returns {?import('../database/models/Player')}
	 */
	get player() {
		return this.user.player;
	}

	/**
	 * player object associated with the discord member
	 */
	set player(value) {
		this.user.player = value;
	}

	/**
	 * hypixelGuild object associated with the discord member
	 */
	get hypixelGuild() {
		return this.player?.hypixelGuild ?? null;
	}
}

Structures.extend('ThreadMember', () => LunarThreadMember);

module.exports = LunarThreadMember;
