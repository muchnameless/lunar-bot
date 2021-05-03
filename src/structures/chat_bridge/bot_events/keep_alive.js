'use strict';

const logger = require('../../../functions/logger');


/**
 * @param {import('../ChatBridge')} chatBridge
 */
module.exports = async (chatBridge) => {
	// stop abort controller
	clearTimeout(chatBridge.minecraft.abortLoginTimeout);
	chatBridge.minecraft.abortLoginTimeout = null;

	// reset relog timeout
	chatBridge.minecraft.loginAttempts = 0;

	// set bot to ready
	chatBridge.minecraft.ready = true;

	logger.debug(`[CHATBRIDGE]: ${chatBridge.logInfo}: spawned and ready`);
};
