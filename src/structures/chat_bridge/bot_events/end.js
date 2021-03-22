'use strict';

const logger = require('../../../functions/logger');


/**
 * @param {import('../ChatBridge')} chatBridge
 */
module.exports = (chatBridge) => {
	logger.error('[CHATBRIDGE END]: Minecraft bot disconnected from server');
	chatBridge.reconnect();
};
