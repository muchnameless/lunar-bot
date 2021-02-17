'use strict';

const logger = require('../../../functions/logger');


/**
 * @param {import('../../LunarClient')} client
 * @param {import('mineflayer').Bot} bot
 */
module.exports = (client, bot) => {
	logger.info('[CHATBRIDGE]: sending mc client to limbo');

	bot.send('§');
};
