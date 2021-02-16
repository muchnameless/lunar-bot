'use strict';

const logger = require('../../../functions/logger');


/**
 * @param {import('../../LunarClient')} client
 * @param {import('mineflayer').Bot} bot
 * @param {string} username ign of the chat message
 * @param {string} message chat message
 */
module.exports = (client, bot) => {
	logger.debug(`[LOGIN]: ${bot.username} logged in`);

	client.minecraftChatBridge.loginAttempts = 0;
	client.minecraftChatBridge.exactDelay = 0;
};
