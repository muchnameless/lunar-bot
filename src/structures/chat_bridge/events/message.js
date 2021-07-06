'use strict';

const { messageTypes: { WHISPER, GUILD, OFFICER, PARTY } } = require('../constants/chatBridge');
const handleServerMessages = require('../functions/handleServerMessages');
const handleCommandMessage = require('../functions/handleCommandMessage');
const logger = require('../../../functions/logger');


/**
 * @param {import('../ChatBridge')} chatBridge
 * @param {import('../HypixelMessage')} message
 */
module.exports = async (chatBridge, message) => {
	// check if the message is a response for ChatBridge#_chat
	chatBridge.minecraft.collect(message);

	if (chatBridge.client.config.get('CHAT_LOGGING_ENABLED')) logger.debug(`[${message.position} #${chatBridge.mcAccount}]: ${message.cleanedContent}`);
	if (!message.rawContent.length) return;

	switch (message.type) {
		case GUILD:
		case OFFICER: {
			if (!chatBridge.enabled || message.me) return;

			message.forwardToDiscord();

			return handleCommandMessage(message);
		}

		case PARTY:
		case WHISPER: {
			if (!chatBridge.enabled || message.me) return;
			if (message.author.player?.guildId !== chatBridge.guild.guildId) return logger.info(`[MESSAGE]: ignored message from '${message.author.ign}': ${message.content}`); // ignore messages from non guild players

			return handleCommandMessage(message);
		}

		default:
			return handleServerMessages(message);
	}
};
