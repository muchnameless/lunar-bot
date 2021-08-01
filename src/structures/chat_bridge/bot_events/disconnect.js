'use strict';

const ChatMessage = require('prismarine-chat')(require('../constants/settings').MC_CLIENT_VERSION);
const logger = require('../../../functions/logger');

/**
 * @param {import('../ChatBridge')} chatBridge
 * @param {{ reason?: string }} param1
 */
module.exports = (chatBridge, { reason }) => {
	try {
		chatBridge.emit('disconnect', reason && new ChatMessage(JSON.parse(reason)).toString());
	} catch (error) {
		logger.error(error);
		chatBridge.emit('disconnect', reason);
	}
};
