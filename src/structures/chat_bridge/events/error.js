'use strict';

const ms = require('ms');
const logger = require('../../../functions/logger');


/**
 * @param {import('../../LunarClient')} client
 * @param {import('mineflayer').Bot} bot
 */
module.exports = (client, bot, error) => {
	logger.error('[CHATBRIDGE ERROR]:', error);

	const LOGIN_DELAY = Math.min((++client.chatBridge.loginAttempts) * 5_000, 60_000);

	try {
		bot.quit();
		logger.warn(`[CHATBRIDGE ERROR]: Minecraft bot disconnected from server, attempting reconnect in ${ms(LOGIN_DELAY, { long: true })}`);
	} catch (err) {
		logger.error('[CHATBRIDGE ERROR]:', err);
	}

	client.chatBridge.clearAllTimeouts();
	client.chatBridge.setTimeout(() => client.chatBridge.connect(), LOGIN_DELAY);
};
