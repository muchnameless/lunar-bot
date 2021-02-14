'use strict';

const LunarGuild = require('../structures/extensions/Guild');
const LunarClient = require('../structures/LunarClient');
const logger = require('../functions/logger');


/**
 * guildCreate
 * @param {LunarClient} client
 * @param {LunarGuild} guild
 */
module.exports = async (client, guild) => {
	if (!client.options.fetchAllMembers) return;

	// Fetch all members in a new guild
	try {
		await guild.members.fetch();
		logger.debug(`[GUILD CREATE]: ${guild.name}: fetched all members`);
	} catch (error) {
		logger.error(`[GUILD CREATE]: ${guild.name}: failed to fetch all members: ${error.name}: ${error.message}`);
	}
};
