'use strict';

const logger = require('../functions/logger');


/**
 * messageDelete
 * @param {import('../structures/LunarClient')} client
 * @param {import('../structures/extensions/Message')} message
 */
module.exports = async (client, message) => {
	const replyData = await message.replyData;

	if (!replyData) return;

	try {
		await client.channels.cache.get(replyData.channelID).deleteMessages(replyData.messageID);

		logger.info(`[REPLY MESSAGE DELETE]: ${message.author.tag}: ${message.content}`);
	} catch (error) {
		logger.error(`[REPLY MESSAGE DELETE]: ${error.name}: ${error.message}`);
	}
};
