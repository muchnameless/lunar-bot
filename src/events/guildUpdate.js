'use strict';

const Event = require('../structures/events/Event');
const logger = require('../functions/logger');


module.exports = class GuildUpdateEvent extends Event {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param {import('../structures/extensions/Guild')} oldGuild
	 * @param {import('../structures/extensions/Guild')} newGuild
	 */
	async run(oldGuild, newGuild) {
		// Fetch all members in a newly available guild
		if (!this.client.options.fetchAllMembers || (oldGuild.available && !newGuild.available)) return;

		try {
			await newGuild.members.fetch();
			logger.debug(`[GUILD UPDATE]: ${newGuild.name}: fetched all members`);
		} catch (error) {
			logger.error(`[GUILD UPDATE]: ${newGuild.name}: failed to fetch all members`, error);
		}
	}
};
