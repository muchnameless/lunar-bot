'use strict';

const MessageEvent = require('./message');
// const logger = require('../functions/logger');


module.exports = class MessageUpdateEvent extends MessageEvent {
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

		if (newMessage.me) this.client.chatBridges.handleDiscordMessage(newMessage, { checkifNotFromBot: false });

		this._handleDiscordMessage(newMessage);
	}
};
