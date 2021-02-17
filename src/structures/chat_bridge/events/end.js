'use strict';

const ms = require('ms');
const logger = require('../../../functions/logger');

/**
 * @param {import('../../LunarClient')} client
 * @param {import('mineflayer').Bot} bot
 */
module.exports = (client, bot) => {
	const LOGIN_DELAY = Math.min((client.chatBridge.loginAttempts + 1) * 5_000, 60_000);

	logger.warn(`[CHATBRIDGE END]: Minecraft bot disconnected from server, attempting reconnect in ${ms(LOGIN_DELAY, { long: true })}`);

	client.chatBridge.clearAllTimeouts();
	client.chatBridge.setTimeout(() => client.chatBridge.connect(), LOGIN_DELAY);
};
