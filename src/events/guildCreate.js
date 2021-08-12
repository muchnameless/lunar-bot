'use strict';

const Event = require('../structures/events/Event');
const logger = require('../functions/logger');


module.exports = class GuildCreateEvent extends Event {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param {import('discord.js').Guild} guild
	 */
	async run(guild) {
		logger.info(`[GUILD CREATE]: ${guild.name}`);

		if (guild.id !== this.config.get('DISCORD_GUILD_ID') || !this.client.options.fetchAllMembers) return;

		try {
			const members = await this.client.fetchAllGuildMembers(guild);
			logger.info(`[GUILD CREATE]: fetched ${members.size} members`);
		} catch (error) {
			logger.error('[GUILD CREATE]', error);
		}
	}
};
