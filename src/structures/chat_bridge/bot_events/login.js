'use strict';

const { defaultSettings } = require('../constants/settings');
const logger = require('../../../functions/logger');


/**
 * @param {import('../ChatBridge')} chatBridge
 */
module.exports = async (chatBridge) => {
	logger.debug(`[MINECRAFT BOT LOGIN]: ${chatBridge.bot.username}: logged in`);

	// remove '-' from uuid
	chatBridge.minecraft.botUuid = chatBridge.bot.uuid.replaceAll('-', '');

	// send settings to server
	chatBridge.bot.write('settings', defaultSettings);

	chatBridge.emit('connect');
};
