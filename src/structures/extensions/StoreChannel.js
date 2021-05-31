'use strict';

const { basename } = require('path');
const { Structures, StoreChannel } = require('discord.js');
// const logger = require('../../functions/logger');


class LunarStoreChannel extends StoreChannel {
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

Structures.extend(basename(__filename, '.js'), () => LunarStoreChannel);

module.exports = LunarStoreChannel;
