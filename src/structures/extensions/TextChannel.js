'use strict';

const { Structures, TextChannel } = require('discord.js');
// const logger = require('../../functions/logger');


class LunarTextChannel extends TextChannel {
	/**
	 * wether the channel is a ticket by yagpdb
	 */
	get isTicket() {
		return this.parentID === this.client.config.get('TICKET_CHANNELS_CATEGORY_ID') && /^\d+-/.test(this.name);
	}

	/**
	 * checks wether the bot has the provided permission(s) in the channel
	 * @param {string|string[]} permFlag
	 */
	checkBotPermissions(permFlag) {
		if (Array.isArray(permFlag)) return permFlag.every(flag => this.checkBotPermissions(flag));
		if (typeof permFlag !== 'string') throw new TypeError('permFlag must be either a string or an Array of strings');

		return this.permissionsFor?.(this.guild?.me).has(permFlag) ?? false;
	}
}

Structures.extend('TextChannel', TextChannel => LunarTextChannel); // eslint-disable-line no-shadow, no-unused-vars

module.exports = LunarTextChannel;
