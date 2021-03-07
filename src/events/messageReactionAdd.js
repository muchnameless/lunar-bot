'use strict';

const { updateLeaderboardMessage } = require('../functions/leaderboardMessages');
const { LOCK } = require('../constants/emojiCharacters');
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

	if (user.id === client.user.id || reaction.message.author.id !== client.user.id) return; // ignore own reactions or on not owned messages

	const { message, emoji } = reaction;

	if (!message.embeds.length) return;

	if (client.config.getBoolean('EXTENDED_LOGGING_ENABLED')) logger.info(`[EVENT]: ${user.tag}${message.guild ? ` | ${(await message.guild.members.fetch(user.id)).displayName}` : ''} reacted with ${emoji.name}`);

	if (!message.embeds[0].title.includes('Leaderboard')) return;

	if (message.guild) {
		const AUTHOR_ID = message.mentions.users.first()?.id;

		if ((user.id !== AUTHOR_ID || emoji.name !== LOCK) && message.channel.checkBotPermissions('MANAGE_MESSAGES')) reaction.users.remove(user).catch(error => logger.error(`[REMOVE REACTION]: ${error.name}: ${error.message}`));

		if (![ AUTHOR_ID, client.ownerID ].includes(user.id)) return;

		// message locked by author
		if (message.reactions.cache.has(LOCK)
			&& (message.reactions.cache.get(LOCK).users.cache.size
				? message.reactions.cache.get(LOCK).users.cache
				: (await message.reactions.cache.get(LOCK).users.fetch().catch(logger.error)))?.has(AUTHOR_ID)
		) return;
	} else if (message.reactions.cache.has(LOCK)) { // DMs
		return;
	}

	updateLeaderboardMessage(message, emoji.name);
};
