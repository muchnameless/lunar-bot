'use strict';

class WebhookError extends Error {
	/**
	 * @param {string} message
	 * @param {import('../extensions/TextChannel')} textChannel
	 * @param {import('../database/models/HypixelGuild')} hypixelGuild
	 */
	constructor(message, channel, hypixelGuild) {
		super(message);

		this.channel = channel;
		this.hypixelGuild = hypixelGuild;
	}
}

module.exports = WebhookError;
