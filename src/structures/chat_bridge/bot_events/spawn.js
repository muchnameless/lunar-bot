'use strict';

const PROTO_VER_1_10 = require('minecraft-data')('1.10.2').version.version;
const logger = require('../../../functions/logger');


/**
 * @param {import('../ChatBridge')} chatBridge
 */
module.exports = async chatBridge => {
	// stop abort controller
	clearTimeout(chatBridge.abortLoginTimeout);

	// reset relog timeout
	chatBridge.loginAttempts = 0;
	chatBridge.maxMessageLength = chatBridge.bot.protocolVersion > PROTO_VER_1_10 ? 256 : 100;

	// link this chatBridge with the bot's guild
	try {
		await chatBridge.link();
	} catch (error) {
		return logger.warn(error);
	}

	// most likely webhook fetching timed out -> simple reconnect
	if (!chatBridge.ready) return chatBridge.reconnect();

	// send bot to limbo (forbidden character in chat)
	chatBridge.sendToMinecraftChat('§');

	logger.debug(`[CHATBRIDGE]: ${chatBridge.guild.name}: ${chatBridge.bot.player.username} spawned and ready`);
};
