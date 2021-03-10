'use strict';

const { messageTypes: { WHISPER, GUILD, OFFICER, PARTY } } = require('../../../constants/chatBridge');
const commandHandler = require('../functions/commandHandler');
const handleRankRequest = require('../functions/handleRankRequest');
const handleServerMessages = require('../functions/handleServerMessages');
const logger = require('../../../functions/logger');


/**
 * @param {import('../ChatBridge')} chatBridge
 * @param {import('../HypixelMessage')} message
 */
module.exports = async (chatBridge, message) => {
	if (chatBridge.client.config.getBoolean('CHAT_LOGGING_ENABLED')) logger.debug(`[${message.position} #${chatBridge.mcAccount}]: ${message.cleanedContent}`);
	if (!message.rawContent.length) return;

	switch (message.type) {
		case GUILD: {
			if (!chatBridge.enabled) return;
			if (message.author.ign === chatBridge.bot.username) return; // ignore own messages

			if (chatBridge.ready) message.forwardToDiscord().catch(error => logger.error('[CHATBRIDGE MESSAGE]', error));

			return commandHandler(message);
		}

		case OFFICER:
		case PARTY: {
			if (!chatBridge.enabled) return;
			if (message.author.ign === chatBridge.bot.username) return; // ignore own messages

			return commandHandler(message);
		}

		case WHISPER: {
			if (!chatBridge.enabled) return;
			if (!message.author.inGuild) return; // ignore messages from non guild players

			handleRankRequest(message).catch(error => logger.error(`[RANK REQUEST]: ${error.name}: ${error.message}`));

			return commandHandler(message);
		}

		default:
			return handleServerMessages(message);
	}
};
