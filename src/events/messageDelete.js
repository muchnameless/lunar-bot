'use strict';

const logger = require('../functions/logger');


/**
 * messageDelete
 * @param {import('../structures/LunarClient')} client
 * @param {import('../structures/extensions/Message')} message
 */
module.exports = async (client, message) => {
	if (!message.replyMessageID) return;

	message.channel?.messages.cache.get(message.replyMessageID)
		?.delete()
		.then(
			() => logger.info(`[REPLY MESSAGE DELETE]: ${message.author.tag}: ${message.content}`),
			error => logger.error(`[REPLY MESSAGE DELETE]: ${error.name}: ${error.message}`),
		);
};
