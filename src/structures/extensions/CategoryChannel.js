'use strict';

const { Structures } = require('discord.js');
// const logger = require('../../functions/logger');


class LunarCategoryChannel extends Structures.get('CategoryChannel') {
	/**
	 * Permissions instance for the bot in that channel
	 */
	get botPermissions() {
		return this.permissionsFor(this.guild.me);
	}

	/**
	 * wether the channel is a ticket by yagpdb
	 */
	get isTicket() {
		return this.parentId === this.client.config.get('TICKET_CHANNELS_CATEGORY_ID') && /-\d+$/.test(this.name);
	}
}

Structures.extend('CategoryChannel', () => LunarCategoryChannel);

module.exports = LunarCategoryChannel;
