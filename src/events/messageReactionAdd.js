'use strict';

const { FORWARD_TO_GC } = require('../constants/emojiCharacters');
const Event = require('../structures/events/Event');
const logger = require('../functions/logger');


module.exports = class MessageReactionAddEvent extends Event {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param {import('discord.js').MessageReaction} reaction
	 * @param {import('discord.js').User} user
	 */
	async run(reaction, { id: userId }) {
	// reaction.message is not from the announcement channel or not the broadcast emoji
		if (reaction.message.channelId !== this.config.get('GUILD_ANNOUNCEMENTS_CHANNEL_ID') || reaction.emoji.name !== FORWARD_TO_GC) return;

		try {
			if (reaction.partial) await reaction.fetch();
			if (reaction.message.partial) await reaction.message.fetch();
		} catch (error) {
			return logger.error('[MESSAGE REACTION ADD]: error while fetching partial', error);
		}

		if (userId === reaction.message.author.id) return this.client.chatBridges.handleAnnouncementMessage(reaction.message);
	}
};
