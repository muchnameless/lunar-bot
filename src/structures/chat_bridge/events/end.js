'use strict';

const ms = require('ms');
const logger = require('../../../functions/logger');

/**
 * @param {import('../../LunarClient')} client
 * @param {import('mineflayer').Bot} bot
 */
module.exports = (client, bot) => {
	let loginDelay = client.chatBridge.exactDelay;

	if (!loginDelay) {
		loginDelay = (client.chatBridge.loginAttempts + 1) * 5000;

		if (loginDelay > 60000) {
			loginDelay = 60000;
		}
	}

	logger.warn(`[CHATBRIDGE END]: Minecraft bot disconnected from server, attempting reconnect in ${ms(loginDelay, { long: true })}`);

	setTimeout(() => client.chatBridge.connect(), loginDelay);
};
