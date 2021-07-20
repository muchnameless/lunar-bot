'use strict';

const MessageCreateEvent = require('./messageCreate');
const logger = require('../functions/logger');


module.exports = class MessageUpdateEvent extends MessageCreateEvent {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param {import('../structures/extensions/Message')} oldMessage
	 * @param {import('../structures/extensions/Message')} newMessage
	 */
	async run(oldMessage, newMessage) {
		if (
			Date.now() - newMessage.createdTimestamp >= 10 * 60_000 // original message is older than 10 min
			|| oldMessage.content === newMessage.content // pinned or embed added
		) return;

		if (newMessage.partial) {
			try {
				await newMessage.fetch();
			} catch (error) {
				return logger.error('[CMD HANDLER]: error while fetching partial message', error);
			}
		}

		this._handleDiscordMessage(newMessage, true);
	}
};
