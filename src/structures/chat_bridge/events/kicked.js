'use strict';

const logger = require('../../../functions/logger');


/**
 * @param {import('../../LunarClient')} client
 * @param {import('mineflayer').Bot} bot
 * @param {string} reason
 * @param {boolean} loggedIn wether the bot was fully logged in at the time of the kick
 */
module.exports = (client, bot, reason, loggedIn) => {
	logger.warn(`[CHATBRIDGE KICKED]: reason: ${reason}, logged in: ${loggedIn}`);

	client.chatBridge.loginAttempts++;
};
