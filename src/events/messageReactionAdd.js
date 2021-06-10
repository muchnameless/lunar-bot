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
module.exports = async (client, reaction, user) => {
	try {
		if (reaction.partial) await reaction.fetch();
		if (reaction.message.partial) await reaction.message.fetch();
	} catch (error) {
		return logger.error('[MESSAGE REACTION ADD]: error while fetching partial', error);
	}

	if (user.id === client.user.id) return; // ignore own reactions or on not owned messages

	if (reaction.message.channel.id === client.config.get('GUILD_ANNOUNCEMENTS_CHANNEL_ID') && reaction.emoji.name === FORWARD_TO_GC && user.id === reaction.message.author.id) {
		return client.chatBridges.handleAnnouncementMessage(reaction.message);
	}
};
