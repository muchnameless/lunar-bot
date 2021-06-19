'use strict';

const { FORWARD_TO_GC } = require('../constants/emojiCharacters');
const logger = require('../functions/logger');


/**
 * messageReactionAdd
 * @param {import('../structures/LunarClient')} client
 * @param {import('discord.js').MessageReaction} reaction
 * @param {import('../structures/extensions/Message')} reaction.message
 * @param {import('discord.js').User} user
 */
module.exports = async (client, reaction, { id: userID }) => {
	// reaction.message is not from the announcement channel or not the broadcast emoji
	if (reaction.message.channel.id !== client.config.get('GUILD_ANNOUNCEMENTS_CHANNEL_ID') || reaction.emoji.name !== FORWARD_TO_GC) return;

	try {
		if (reaction.partial) await reaction.fetch();
		if (reaction.message.partial) await reaction.message.fetch();
	} catch (error) {
		return logger.error('[MESSAGE REACTION ADD]: error while fetching partial', error);
	}

	if (userID === reaction.message.author.id) return client.chatBridges.handleAnnouncementMessage(reaction.message);
};
