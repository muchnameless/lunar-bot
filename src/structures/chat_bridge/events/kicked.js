'use strict';

const ms = require('ms');
const logger = require('../../../functions/logger');

/**
 * @param {import('../../LunarClient')} client
 * @param {import('mineflayer').Bot} bot
 */
module.exports = (client, bot, ...args) => {
	/**
	 * @type {number}
	 */
	const LOGIN_DELAY = client.chatBridge.exactDelay || Math.min((client.chatBridge.loginAttempts++) * 5_000, 60_000);

	logger.warn(`[CHATBRIDGE KICKED]: Minecraft bot kicked from server, (${args}) attempting reconnect in ${ms(LOGIN_DELAY, { long: true })}`);

	client.setTimeout(() => client.chatBridge.connect(), LOGIN_DELAY);
};
