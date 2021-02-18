'use strict';

const ms = require('ms');
const logger = require('../../../functions/logger');


/**
 * @param {import('../ChatBridge')} chatBridge
 */
module.exports = (chatBridge, error) => {
	logger.error('[CHATBRIDGE ERROR]:', error);

	try {
		chatBridge.bot.quit();
	} catch (err) {
		logger.error('[CHATBRIDGE ERROR]:', err);
	}

	chatBridge.reconnect();
};
