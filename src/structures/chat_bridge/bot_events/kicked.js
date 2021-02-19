'use strict';

const logger = require('../../../functions/logger');


/**
 * @param {import('../ChatBridge')} chatBridge
 * @param {string} reason
 * @param {boolean} loggedIn wether the bot was fully logged in at the time of the kick
 */
module.exports = (chatBridge, reason, loggedIn) => {
	logger.warn(`[CHATBRIDGE KICKED]: reason: ${reason}, logged in: ${loggedIn}`);

	++chatBridge.loginAttempts;
};
