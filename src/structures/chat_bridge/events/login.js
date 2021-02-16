'use strict';

const logger = require('../../../functions/logger');


/**
 * @param {import('../../LunarClient')} client
 * @param {import('mineflayer').Bot} bot
 * @param {string} username ign of the chat message
 * @param {string} message chat message
 */
module.exports = (client, bot) => {
	logger.debug(`[CHATBRIDGE LOGIN]: logged in as ${bot.username}`);

	client.chatBridge.loginAttempts = 0;
	client.chatBridge.exactDelay = 0;
};
