'use strict';

const logger = require('../functions/logger');


module.exports = async (client, guild) => {
	logger.debug(`[GUILD UNAVAILABLE]: ${guild.name}`);
};
