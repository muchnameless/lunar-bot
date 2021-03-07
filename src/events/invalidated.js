'use strict';

const logger = require('../functions/logger');


/**
 * invalidated
 * @param {import('../structures/LunarClient')} client
 */
module.exports = async (client) => {
	logger.warn('[INVALIDATED]: the client became invalidated');
	client.db.closeConnectionAndExit();
};
