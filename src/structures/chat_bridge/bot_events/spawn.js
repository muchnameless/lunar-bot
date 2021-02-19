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

		return logger.warn(`[CHATBRIDGE]: ${chatBridge.bot.player.username}: no matching guild found`);
	}

	guild.chatBridge = chatBridge;
	chatBridge.guild = guild;

	logger.debug(`[CHATBRIDGE]: ${guild.name}: linked to ${chatBridge.bot.player.username}`);

	await chatBridge.fetchAndCacheWebhook();

	if (chatBridge.criticalError) return;
	if (!chatBridge.ready) return chatBridge.reconnect();

	// send bot to limbo (forbidden character in chat)
	chatBridge.sendToMinecraftChat('§');

	logger.debug(`[CHATBRIDGE]: ${guild.name}: ${chatBridge.bot.player.username} spawned and ready`);
};
