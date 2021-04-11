'use strict';

const logger = require('../../../functions/logger');


/**
 * @param {import('../ChatBridge')} chatBridge
 * @param {object} param1
 * @param {string} param1.reason
 */
module.exports = (chatBridge, { reason }) => {
	chatBridge.ready = false;

	logger.error(`[CHATBRIDGE KICKED]: ${chatBridge.logInfo}: disconnect while loggin in, reason: ${reason}`);
};
