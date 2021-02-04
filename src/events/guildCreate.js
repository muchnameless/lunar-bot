'use strict';

const logger = require('../functions/logger');


module.exports = async (client, guild) => {
	// if (!client.options.fetchAllMembers) return;

	// Fetch all members in a new guild
	guild.members.fetch().then(
		() => logger.debug(`[GUILD CREATE]: ${guild.name}: fetched all members`),
		error => logger.error(`[GUILD CREATE]: ${guild.name}: failed to fetch all members: ${error.name}: ${error.message}`),
	);
};
