'use strict';

const logger = require('../../../functions/logger');

/**
 * @param {import('../../LunarClient')} client
 * @param {import('mineflayer').Bot} bot
 */
module.exports = (client, bot) => {
	let loginDelay = client.minecraftChatBridge.exactDelay;

	if (!loginDelay) {
		loginDelay = (client.minecraftChatBridge.loginAttempts + 1) * 5000;

		if (loginDelay > 60000) {
			loginDelay = 60000;
		}
	}

	logger.warn(`[END]: Minecraft bot disconnected from server, attempting reconnect in ${loginDelay / 1000} seconds`);

	setTimeout(() => client.minecraftChatBridge.connect(), loginDelay);
};
