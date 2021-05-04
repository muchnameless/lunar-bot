'use strict';

const logger = require('../../../functions/logger');


/**
 * @param {import('../ChatBridge')} chatBridge
 */
module.exports = (chatBridge, error) => {
	logger.error('[CHATBRIDGE ERROR]:', error);

	if (error.message.includes('Invalid credentials')) {
		chatBridge.minecraft.shouldReconnect = false;
		chatBridge.minecraft.disconnect();

		return logger.error('[CHATBRIDGE]: invalid credentials detected');
	}

	chatBridge.minecraft.reconnect();
};
