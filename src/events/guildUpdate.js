'use strict';

const logger = require('../functions/logger');


module.exports = async (client, oldGuild, newGuild) => {
	// if (!client.options.fetchAllMembers) return;

	// Fetch all members in a newly available guild
	if (!oldGuild.available && newGuild.available) {
		newGuild.members.fetch().then(
			() => logger.debug(`[GUILD UPDATE]: ${newGuild.name}: fetched all members`),
			error => logger.error(`[GUILD UPDATE]: ${newGuild.name}: failed to fetch all members: ${error.name}: ${error.message}`),
		);
	}
};
