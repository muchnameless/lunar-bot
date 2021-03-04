'use strict';

const { messageTypes: { WHISPER, GUILD } } = require('../../../constants/chatBridge');
const commandHandler = require('../functions/commandHandler');
const handleRankRequest = require('../functions/handleRankRequest');
const handleServerMessages = require('../functions/handleServerMessages');
const logger = require('../../../functions/logger');


/**
 * @param {import('../ChatBridge')} chatBridge
 * @param {import('../HypixelMessage')} message
 */
module.exports = async (chatBridge, message) => {
	if (chatBridge.client.config.getBoolean('CHAT_LOGGING_ENABLED')) logger.debug(`[${message.position} #${chatBridge.mcAccount}]: ${message.rawContent}`);

	if (!chatBridge.guild) {
		/**
		 * You joined GUILD_NAME!
		 */
		const guildJoinMatched = message.content.match(/(?<=^You joined ).+(?=!)/);

		if (guildJoinMatched) {
			const [ guildName ] = guildJoinMatched;

			chatBridge.client.hypixelGuilds.getByName(guildName)?.updatePlayers().catch(error => logger.error(`[CHATBRIDGE]: guild update: ${error.name}: ${error.message}`));
			logger.info(`[CHATBRIDGE]: ${chatBridge.bot.username}: joined ${guildName}`);
			return chatBridge.link(guildName);
		}

		return;
	}

	if (!chatBridge.guild.chatBridgeEnabled) return;
	if (!message.rawContent.length) return;

	switch (message.type) {
		case GUILD: {
			if (message.author.ign === chatBridge.bot.username) return; // ignore own messages

			if (chatBridge.ready) await message.forwardToDiscord();

			return commandHandler(message);
		}

		case WHISPER: {
			if (!message.author.inGuild) return; // ignore messages from non guild players

			handleRankRequest(message).catch(error => logger.error(`[RANK REQUEST]: ${error.name}: ${error.message}`));

			return commandHandler(message);
		}

		default:
			return handleServerMessages(message);
	}
};
