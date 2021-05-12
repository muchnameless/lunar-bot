'use strict';

const logger = require('../functions/logger');


/**
 * guildCreate
 * @param {import('../structures/LunarClient')} client
 * @param {import('../structures/extensions/Guild')} guild
 */
module.exports = async (client, guild) => {
	if (!client.options.fetchAllMembers) return;

	// Fetch all members in a new guild
	try {
		await guild.members.fetch();
		logger.debug(`[GUILD CREATE]: ${guild.name}: fetched all members`);
	} catch (error) {
		logger.error(`[GUILD CREATE]: ${guild.name}: failed to fetch all members`, error);
	}
};
