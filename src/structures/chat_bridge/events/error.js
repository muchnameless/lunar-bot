'use strict';

const logger = require('../../../functions/logger');


/**
 * @param {import('../../LunarClient')} client
 * @param {import('mineflayer').Bot} bot
 */
module.exports = (client, bot, error) => {
	logger.error('[CHATBRIDGE ERROR]:', error);
};
