'use strict';

const LunarMessage = require('../structures/extensions/Message');
const LunarClient = require('../structures/LunarClient');
const logger = require('../functions/logger');


/**
 * messageDelete
 * @param {LunarClient} client
 * @param {LunarMessage} message
 */
module.exports = async (client, message) => {
	if (!message.replyMessageID) return;

	message.channel?.messages.cache.get(message.replyMessageID)?.delete().then(
		() => logger.info(`[REPLY MESSAGE DELETE]: ${message.author.tag}: ${message.content}`),
		error => logger.error(`[REPLY MESSAGE DELETE]: ${error.name}: ${error.message}`),
	);
};
