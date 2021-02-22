'use strict';

const { defaultSettings } = require('../../../constants/chatBridge');
const logger = require('../../../functions/logger');


/**
 * @param {import('../ChatBridge')} chatBridge
 */
module.exports = async chatBridge => {
	logger.debug(`[CHATBRIDGE]: ${chatBridge.bot.username}: logged in, sending to limbo`);

	chatBridge.bot.write('settings', defaultSettings);

	// send bot to limbo (forbidden character in chat)
	chatBridge.queueForMinecraftChat('§');
};
