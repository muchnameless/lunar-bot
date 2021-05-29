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

	// link chatBridge to the bot account's guild
	chatBridge.link();

	// send bot to limbo (forbidden character in chat)
	let counter = 5;

	do {
		try {
			await chatBridge.minecraft.command({
				command: 'ac §',
				responseRegExp: /^A kick occurred in your connection, so you have been routed to limbo!$|^Illegal characters in chat$|^You were spawned in Limbo\.$|^\/limbo for more information\.$/,
				rejectOnTimeout: true,
				max: 1,
			});

			logger.debug(`[CHATBRIDGE]: ${chatBridge.logInfo}: sent to limbo`);
			break;
		} catch (error) {
			logger.error(`[CHATBRIDGE]: ${chatBridge.logInfo}: error while sending to limbo`, error);
		}
	} while (--counter);
};
