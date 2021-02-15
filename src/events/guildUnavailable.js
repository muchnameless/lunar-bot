'use strict';

const logger = require('../functions/logger');


/**
 * guildUnavailable
 * @param {import('../structures/LunarClient')} client
 * @param {import('../structures/extensions/Guild')} guild
 */
module.exports = async (client, guild) => {
	logger.debug(`[GUILD UNAVAILABLE]: ${guild.name}`);

	// sweep linked discord members cache
	if (guild.id === client.config.get('DISCORD_GUILD_ID')) client.players.sweepDiscordMemberCache();
};
