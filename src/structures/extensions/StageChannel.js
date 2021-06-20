'use strict';

const { Structures } = require('discord.js');
// const logger = require('../../functions/logger');


class LunarStageChannel extends Structures.get('StageChannel') {
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
		return this.parentID === this.client.config.get('TICKET_CHANNELS_CATEGORY_ID') && /^\d+-/.test(this.name);
	}
}

Structures.extend('StageChannel', () => LunarStageChannel);

module.exports = LunarStageChannel;
