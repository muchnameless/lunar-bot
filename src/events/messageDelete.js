'use strict';

const logger = require('../functions/logger');


/**
 * messageDelete
 * @param {import('../structures/LunarClient')} client
 * @param {import('../structures/extensions/Message')} message
 */
module.exports = async (client, message) => {
	if (!message.replyMessageID) return;

	try {
		await client.channels.cache.get(message.replyChannelID).deleteMessages(message.replyMessageID);

		logger.info(`[REPLY MESSAGE DELETE]: ${message.author.tag}: ${message.content}`);
	} catch (error) {
		logger.error(`[REPLY MESSAGE DELETE]: ${error.name}: ${error.message}`);
	}
};
