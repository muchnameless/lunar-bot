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
	const guild = chatBridge.client.hypixelGuilds.cache.find(hGuild => hGuild.players.has(chatBridge.bot.player.uuid.replace(/-/g, '')));

	if (!guild) {
		chatBridge.ready = false;

		logger.warn(`[CHATBRIDGE]: no guild matching ${chatBridge.bot.player.username} found`);
	}

	guild.chatBridge = chatBridge;
	chatBridge.guild = guild;

	await chatBridge.fetchAndCacheWebhook();

	if (!chatBridge.ready) return chatBridge.reconnect();

	// send bot to limbo (forbidden character in chat)
	chatBridge.chat('§');

	logger.info(`[CHATBRIDGE]: ${guild.name}: ${chatBridge.bot.player.username} online`);
};
