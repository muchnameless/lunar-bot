'use strict';

const Event = require('../structures/events/Event');
const logger = require('../functions/logger');


module.exports = class MessageDeleteEvent extends Event {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param {import('../structures/extensions/Message')} message
	 */
	async run(message) {
		const replyData = await message.replyData;

		if (!replyData) return;

		try {
			await this.client.channels.cache.get(replyData.channelID).deleteMessages(replyData.messageID);

			logger.info(`[REPLY MESSAGE DELETE]: ${message.logInfo}: ${message.content}`);
		} catch (error) {
			logger.error('[REPLY MESSAGE DELETE]', error);
		}
	}
};
