'use strict';

const { defaultSettings } = require('../constants/settings');
const logger = require('../../../functions/logger');


/**
 * @param {import('../ChatBridge')} chatBridge
 */
module.exports = async (chatBridge) => {
	logger.debug(`[CHATBRIDGE]: ${chatBridge.bot.ign}: logged in, sending to limbo`);

	// remove '-' from uuid
	chatBridge.bot.uuid = chatBridge.bot.uuid.replace(/-/g, '');

	// send settings to server
	chatBridge.bot.write('settings', defaultSettings);

	// send bot to limbo (forbidden character in chat)
	chatBridge.sendToMinecraftChat('/ac §');
};
