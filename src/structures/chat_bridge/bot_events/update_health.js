'use strict';

const logger = require('../../../functions/logger');


/**
 * @param {import('../ChatBridge')} chatBridge
 */
module.exports = async (chatBridge) => {
	// stop abort controller
	clearTimeout(chatBridge.abortLoginTimeout);

	// reset relog timeout
	chatBridge.loginAttempts = 0;

	// link this chatBridge with the bot's guild
	try {
		await chatBridge.link();
	} catch (error) {
		return logger.warn(error);
	}

	// most likely webhook fetching timed out -> simple reconnect
	if (!chatBridge.ready) return chatBridge.reconnect();

	logger.debug(`[CHATBRIDGE]: ${chatBridge.guild.name}: ${chatBridge.bot.ign} spawned and ready`);
};
