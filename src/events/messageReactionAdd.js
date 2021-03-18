'use strict';

const { updateLeaderboardMessage } = require('../functions/leaderboardMessages');
const { X_EMOJI, LOCK, FORWARD_TO_GC } = require('../constants/emojiCharacters');
const logger = require('../functions/logger');
const { stripIndent } = require('common-tags');


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

	const { message, emoji: { name: EMOJI_NAME } } = reaction;

	if (client.config.getBoolean('EXTENDED_LOGGING_ENABLED')) logger.info(`[MESSAGE REACTION ADD]: ${user.tag}${message.guild ? ` | ${(await message.guild.members.fetch(user.id).catch(logger.error))?.displayName ?? ''}` : ''} reacted with ${EMOJI_NAME}`);

	if (message.channel.id === client.config.get('GUILD_ANNOUNCEMENTS_CHANNEL_ID') && EMOJI_NAME === FORWARD_TO_GC && user.id === message.author.id) {
		if (!client.chatBridges.length) return message.reactSafely(X_EMOJI);

		try {
			const result = await client.chatBridges.broadcast(
				stripIndent`
					${message.content}
					~ ${message.author.player?.ign ?? message.member?.displayName ?? message.author.username}
				`,
				{
					discord: {
						split: { char: '\n' },
						allowedMentions: { parse: [] },
					},
					ingame: {
						prefix: 'Guild_Announcement:',
						maxParts: Infinity,
					},
				},
			);

			if (!result.every(([ ingame, discord ]) => ingame && (Array.isArray(discord) ? discord.length : discord))) message.reactSafely(X_EMOJI);
		} catch (error) {
			logger.error(`[MESSAGE REACTION ADD]: announcement: ${error.name}: ${error.message}`);
			message.reactSafely(X_EMOJI);
		}

		return;
	}

	if (message.author.id !== client.user.id || !message.embeds[0]?.title.includes('Leaderboard')) return;

	if (message.guild) {
		const AUTHOR_ID = message.mentions.users.first()?.id;

		if ((user.id !== AUTHOR_ID || EMOJI_NAME !== LOCK) && message.channel.checkBotPermissions('MANAGE_MESSAGES')) reaction.users.remove(user).catch(error => logger.error(`[REMOVE REACTION]: ${error.name}: ${error.message}`));

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

	updateLeaderboardMessage(message, EMOJI_NAME);
};
