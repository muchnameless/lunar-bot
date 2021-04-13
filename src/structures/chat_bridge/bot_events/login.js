'use strict';

const { defaultSettings } = require('../constants/settings');
const logger = require('../../../functions/logger');


/**
 * @param {import('../ChatBridge')} chatBridge
 */
module.exports = async (chatBridge) => {
	logger.debug(`[CHATBRIDGE]: ${chatBridge.bot.ign}: logged in`);

	// remove '-' from uuid
	chatBridge.bot.uuid = chatBridge.bot.uuid.replace(/-/g, '');

	// send settings to server
	chatBridge.bot.write('settings', defaultSettings);

	// send bot to limbo (forbidden character in chat)
	let counter = 5;

	do {
		try {
			await chatBridge.command({
				command: 'ac §',
				responseRegex: /^A kick occurred in your connection, so you have been routed to limbo!$|^Illegal characters in chat$|^You were spawned in Limbo\.$|^\/limbo for more information\.$/,
				rejectOnTimeout: true,
			});

			logger.debug(`[CHATBRIDGE]: ${chatBridge.bot.ign}: sent to limbo`);
			break;
		} catch (error) {
			logger.error(`[CHATBRIDGE]: ${chatBridge.bot.ign}: error while sending to limbo: ${error}`);
		}
	} while (--counter);
};
