'use strict';

module.exports = class WebhookError extends Error {
	/**
	 * @param {string} message
	 * @param {import('discord.js').TextChannel} channel
	 * @param {import('../database/models/HypixelGuild')} hypixelGuild
	 */
	constructor(message, channel, hypixelGuild) {
		super(message);

		this.name = 'WebhookError';
		this.channel = channel;
		this.hypixelGuild = hypixelGuild;
	}
};
