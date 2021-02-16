'use strict';

const logger = require('../../../functions/logger');

/**
 * @param {import('../../LunarClient')} client
 * @param {import('mineflayer').Bot} bot
 */
module.exports = (client, bot, ...args) => {
	logger.warn(`[CHATBRIDGE KICKED]: ${args}`);

	client.chatBridge.loginAttempts++;
};
