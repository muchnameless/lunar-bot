'use strict';

const { Structures, Permissions } = require('discord.js');
// const logger = require('../../functions/logger');


class LunarTextChannel extends Structures.get('TextChannel') {
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

	/**
	 * deletes all provided messages from the channel with as few API calls as possible
	 * @param {string|string[]} Ids
	 */
	deleteMessages(Ids) {
		if (Array.isArray(Ids)) {
			if (this.botPermissions.has(Permissions.FLAGS.MANAGE_MESSAGES)) return this.bulkDelete(Ids);

			return Promise.all(Ids.map(async (id) => {
				const message = this.messages.cache.get(id);

				if (message?.deleted || !(message?.deletable ?? true)) return;

				this.messages.delete(id);
			}));
		}

		const message = this.messages.cache.get(Ids);

		if (message?.deleted || !(message?.deletable ?? true)) return;

		return this.messages.delete(Ids);
	}
}

Structures.extend('TextChannel', () => LunarTextChannel);

module.exports = LunarTextChannel;
