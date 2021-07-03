'use strict';

const MessageCreateEvent = require('./messageCreate');
// const logger = require('../functions/logger');


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
		if (oldMessage.content === newMessage.content) return; // pin or added embed
		if (Date.now() - newMessage.createdTimestamp >= 24 * 60 * 60_000) return; // original message is older than a day

		if (newMessage.me) this.client.chatBridges.handleDiscordMessage(newMessage, { checkifNotFromBot: false });

		this._handleDiscordMessage(newMessage);
	}
};
