'use strict';

const logger = require('../../../functions/logger');


/**
 * @param {import('../ChatBridge')} chatBridge
 */
module.exports = chatBridge => {
	// stop abort controller
	clearTimeout(chatBridge.abortConnectionTimeout);

	// link this chatBridge with the bot's guild
	const guild = chatBridge.client.hypixelGuilds.cache.find(hGuild => hGuild.players.has(chatBridge.bot.player.uuid.replace(/-/g, '')));

	if (guild) {
		guild.chatBridge = chatBridge;
		chatBridge.guild = guild;
		logger.info(`[CHATBRIDGE]: ${guild.name}: ${chatBridge.bot.player.username} online`);
	} else {
		logger.warn(`[CHATBRIDGE]: no guild matching ${chatBridge.bot.player.username} found`);
	}

	// reset relog timeout
	chatBridge.loginAttempts = 0;
	this.ready = true;

	// send bot to limbo (forbidden character in chat)
	chatBridge.chat('§');
};
