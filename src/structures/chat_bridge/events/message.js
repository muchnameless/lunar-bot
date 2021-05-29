'use strict';

const { messageTypes: { WHISPER, GUILD, OFFICER, PARTY } } = require('../constants/chatBridge');
const commandHandler = require('../functions/commandHandler');
const handleServerMessages = require('../functions/handleServerMessages');
const logger = require('../../../functions/logger');


/**
 * @param {import('../ChatBridge')} chatBridge
 * @param {import('../HypixelMessage')} message
 */
module.exports = async (chatBridge, message) => {
	// check if the message is a response for ChatBridge#_chat
	chatBridge.minecraft.collect(message);

	if (chatBridge.client.config.getBoolean('CHAT_LOGGING_ENABLED')) logger.debug(`[${message.position} #${chatBridge.mcAccount}]: ${message.cleanedContent}`);
	if (!message.rawContent.length) return;

	switch (message.type) {
		case GUILD:
		case OFFICER: {
			if (!chatBridge.enabled || message.me) return;

			message.forwardToDiscord();

			return commandHandler(message);
		}

		case PARTY: {
			if (!chatBridge.enabled || message.me) return;

			return commandHandler(message);
		}

		case WHISPER: {
			if (!chatBridge.enabled || message.me) return;
			if (message.author.player?.guildID !== chatBridge.guild.guildID) return logger.info(`[MESSAGE]: ignored whisper from '${message.author.ign}': ${message.content}`); // ignore messages from non guild players

			chatBridge.guild.handleRankRequestMessage(message).catch(error => logger.error('[RANK REQUEST]', error));

			return commandHandler(message);
		}

		default:
			return handleServerMessages(message);
	}
};
