'use strict';

const logger = require('../../../functions/logger');


/**
 * @param {import('../ChatBridge')} chatBridge
 */
module.exports = (chatBridge, error) => {
	logger.error('[CHATBRIDGE ERROR]:', error);
	chatBridge.reconnect();
};
