'use strict';

const { updateLeaderboardMessage } = require('../functions/commands/leaderboardMessages');
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
		if (reaction.message.partial) await reaction.message.fetch();
		if (reaction.partial) await reaction.fetch();
	} catch (error) {
		return logger.error('[MESSAGE REACTION ADD]: error while fetching partial', error);
	}

	if (user.id === client.user.id) return; // ignore own reactions or on not owned messages

	const { message } = reaction;

	if (client.config.getBoolean('EXTENDED_LOGGING_ENABLED')) logger.info(`[MESSAGE REACTION ADD]: ${user.tag}${message.guild ? ` | ${(await message.guild.members.fetch(user.id).catch(logger.error))?.displayName ?? ''}` : ''} reacted with ${reaction.emoji.name}`);

	if (message.channel.id === client.config.get('GUILD_ANNOUNCEMENTS_CHANNEL_ID') && reaction.emoji.name === FORWARD_TO_GC && user.id === message.author.id) {
		return client.chatBridges.handleAnnouncementMessage(message);
	}

	if (message.author.id !== client.user.id || !message.embeds[0]?.title?.includes('Leaderboard')) return;

	updateLeaderboardMessage(message, reaction, user);
};
