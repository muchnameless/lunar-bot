'use strict';

const logger = require('../functions/logger');


module.exports = async (client, guild) => {
	logger.debug(`[GUILD UNAVAILABLE]: ${guild.name}`);

	// sweep linked discord members cache
	if (guild.id === client.config.get('DISCORD_GUILD_ID')) client.players.sweepDiscordMemberCache();
};
