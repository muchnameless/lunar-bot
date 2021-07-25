'use strict';

const { MessageFlags, Permissions } = require('discord.js');
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
		// ignore ephemeral messages (slash cmd response edits)
		if (newMessage.flags.has(MessageFlags.FLAGS.EPHEMERAL)) return;

		if (
			Date.now() - newMessage.createdTimestamp >= 10 * 60_000 // original message is older than 10 min
			|| oldMessage.content === newMessage.content // pinned or embed added
			|| !newMessage.channel?.botPermissions.has(Permissions.FLAGS.VIEW_CHANNEL) // slash cmd response edits
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
