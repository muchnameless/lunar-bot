'use strict';

const logger = require('../functions/logger');


/*
	doesn't emit in all cases, so it's pretty useless, code from: S:\pi\lunar_bot_dev\node_modules\discord.js\src\client\websocket\handlers\GUILD_CREATE.js
 */

/**
 * guildUpdate
 * @param {import('../structures/LunarClient')} client
 * @param {import('../structures/extensions/Guild')} oldGuild
 * @param {import('../structures/extensions/Guild')} newGuild
 */
module.exports = async (client, oldGuild, newGuild) => {
	if (!client.options.fetchAllMembers) return;

	// Fetch all members in a newly available guild
	if (oldGuild.available || !newGuild.available) return;

	try {
		await newGuild.members.fetch();
		logger.debug(`[GUILD CREATE]: ${newGuild.name}: fetched all members`);
	} catch (error) {
		logger.error(`[GUILD CREATE]: ${newGuild.name}: failed to fetch all members: ${error.name}: ${error.message}`);
	}
};
