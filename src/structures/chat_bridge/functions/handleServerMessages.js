'use strict';

const {
	defaults: { ign: IGN_REGEXP },
	promote: { string: { success: promote } },
	demote: { string: { success: demote } },
	mute: { string: { success: mute } },
	unmute: { string: { success: unmute } },
	spamMessages,
} = require('../constants/commandResponses');
const { STOP } = require('../../../constants/emojiCharacters');
const { invisibleCharacters } = require('../constants/chatBridge');
const { stringToMS } = require('../../../functions/util');
const logger = require('../../../functions/logger');


const demoteRegExp = new RegExp(demote(), 'i');
const promoteRegExp = new RegExp(promote(), 'i');
const muteRegExp = new RegExp(mute(), 'i');
const unmuteRegExp = new RegExp(unmute(), 'i');

/**
 * handles a hypixel server message (non user message)
 * @param {import('../HypixelMessage')} message
 */
module.exports = async (message) => {
	/**
	 * You cannot say the same message twice!
	 * You can only send a message once every half second!
	 */
	if (spamMessages.includes(message.content)) {
		try {
			await message.client.dmOwner(`${message.chatBridge.logInfo}: anti spam failed: ${message.rawContent}`);
		} catch (error) {
			logger.error(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: error DMing owner anti spam failed`);
		}

		return logger.error(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: anti spam failed: ${message.rawContent}`);
	}

	/**
	 * We blocked your comment "aFate: its because i said the sex word" as it is breaking our rules because it contains inappropriate content with adult themes. http://www.hypixel.net/rules/
	 */
	if (message.content.startsWith('We blocked your comment ')) {
		// react to latest message from 'sender' with that content
		const blockedMatched = message.rawContent.match(new RegExp(`^We blocked your comment "(?:(?<sender>${IGN_REGEXP}): )?(?<blockedContent>.+) [${invisibleCharacters.join('')}]*" as it is breaking our rules because it`, 'su'));

		if (blockedMatched) {
			const { groups: { sender, blockedContent } } = blockedMatched;
			const senderDiscordID = message.client.players.findByIGN(sender)?.discordID;

			// react to latest message from 'sender' with that content
			for (const { channel } of message.chatBridge.discord.channels.values()) {
				channel?.messages.cache
					.filter(({ content, author: { id } }) => (senderDiscordID ? id === senderDiscordID : true) && message.chatBridge.minecraft.parseContent(content).includes(blockedContent))
					.sort(({ createdTimestamp: createdTimestampA }, { createdTimestamp: createdTimestampB }) => createdTimestampB - createdTimestampA)
					.first()
					?.react(STOP);
			}
		}

		// DM owner to add the blocked content to the filter
		try {
			await message.client.dmOwner(`${message.chatBridge.logInfo}: blocked message: ${message.rawContent}`);
		} catch (error) {
			logger.error(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: error DMing owner blocked message`);
		}

		return logger.error(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: blocked message: ${message.rawContent}`);
	}

	/**
	 * auto '/gc welcome'
	 * [HypixelRank] IGN joined the guild!
	 */
	if (message.content.includes('joined the guild')) {
		message.chatBridge.guild?.updatePlayers().catch(error => logger.error(`[CHATBRIDGE]: guild update: ${error}`));
		message.forwardToDiscord();
		return message.chatBridge.broadcast('welcome');
	}

	/**
	 * [HypixelRank] IGN left the guild!
	 */
	if (message.content.includes('left the guild!')) {
		message.chatBridge.guild?.updatePlayers().catch(error => logger.error(`[CHATBRIDGE]: guild update: ${error}`));
		return message.forwardToDiscord();
	}

	/**
	 * You left the guild
	 */
	if (message.content === 'You left the guild') {
		logger.warn(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: bot left the guild`);
		message.chatBridge.guild?.updatePlayers().catch(error => logger.error(`[CHATBRIDGE]: guild update: ${error}`));
		message.forwardToDiscord();
		return message.chatBridge.unlink();
	}

	/**
	 * [HypixelRank] IGN was kicked from the guild by [HypixelRank] IGN!
	 */
	if (message.content.includes('was kicked from the guild by')) {
		message.chatBridge.guild?.updatePlayers().catch(error => logger.error(`[CHATBRIDGE]: guild update: ${error}`));
		return message.forwardToDiscord();
	}

	/**
	 * You were kicked from the guild by [HypixelRank] IGN for reason 'REASON'.
	 */
	if (message.content.startsWith('You were kicked from the guild by')) {
		logger.warn(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: bot was kicked from the guild`);
		message.chatBridge.guild?.updatePlayers().catch(error => logger.error(`[CHATBRIDGE]: guild update: ${error}`));
		message.forwardToDiscord();
		return message.chatBridge.unlink();
	}

	/**
	 * auto '/gc gg' for quest completions
	 * The guild has completed Tier 3 of this week's Guild Quest!
	 * The Guild has reached Level 36!
	 * The Guild has unlocked Winners III!
	 */
	if (/^the guild has (?:completed|reached|unlocked)/i.test(message.content)) {
		return message.forwardToDiscord();
	}

	/**
	 * mute
	 * [HypixelRank] IGN has muted [HypixelRank] IGN for 10s
	 * [HypixelRank] IGN has muted the guild chat for 10M
	 */
	const muteMatched = message.content.match(muteRegExp);

	if (muteMatched) {
		message.forwardToDiscord();

		const { groups: { target, duration } } = muteMatched;

		if (target === 'the guild chat') {
			const { guild } = message.chatBridge;
			const msDuration = stringToMS(duration);

			guild.chatMutedUntil = Number.isNaN(msDuration)
				? Infinity
				: Date.now() + msDuration;
			guild.save();

			return logger.info(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: guild chat was muted for ${duration}`);
		}

		const player = message.client.players.findByIGN(target);

		if (!player) return;

		const msDuration = stringToMS(duration);

		player.chatBridgeMutedUntil = Number.isNaN(msDuration)
			? Infinity
			: Date.now() + msDuration;
		player.save();

		return logger.info(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: ${target} was muted for ${duration}`);
	}

	/**
	 * unmute
	 * [HypixelRank] IGN has unmuted [HypixelRank] IGN
	 * [HypixelRank] IGN has unmuted the guild chat!
	 */
	const unmuteMatched = message.content.match(unmuteRegExp);

	if (unmuteMatched) {
		message.forwardToDiscord();

		const { groups: { target } } = unmuteMatched;

		if (target === 'the guild chat') {
			const { guild } = message.chatBridge;

			guild.chatMutedUntil = 0;
			guild.save();

			return logger.info(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: guild chat was unmuted`);
		}

		const player = message.client.players.findByIGN(target);

		if (!player) return;

		player.chatBridgeMutedUntil = 0;
		player.save();

		return logger.info(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: ${target} was unmuted`);
	}

	/**
	 * auto '/gc gg' for promotions
	 * [HypixelRank] IGN was promoted from PREV to NOW
	 */
	const promoteMatched = message.content.match(promoteRegExp);

	if (promoteMatched) {
		message.forwardToDiscord();
		message.chatBridge.broadcast('gg');

		const { groups: { target, newRank } } = promoteMatched;
		const player = message.client.players.findByIGN(target);

		if (!player?.guildID) return logger.info(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: '${target}' was promoted to '${newRank}' but not in the db`);

		const GUILD_RANK_PRIO = (message.chatBridge.guild ?? player.guild)?.ranks.find(({ name }) => name === newRank)?.priority;

		if (!GUILD_RANK_PRIO) return logger.info(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: '${target}' was promoted to an unknown rank '${newRank}'`);

		player.guildRankPriority = GUILD_RANK_PRIO;
		player.save();

		return logger.info(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: '${target}' was promoted to '${newRank}'`);
	}

	/**
	 * demote
	 * [HypixelRank] IGN was demoted from PREV to NOW
	 */
	const demotedMatched = message.content.match(demoteRegExp);

	if (demotedMatched) {
		message.forwardToDiscord();

		const { groups: { target, newRank } } = demotedMatched;
		const player = message.client.players.findByIGN(target);

		if (!player?.guildID) return logger.info(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: '${target}' was demoted to '${newRank}' but not in the db`);

		const GUILD_RANK_PRIO = (message.chatBridge.guild ?? player.guild)?.ranks.find(({ name }) => name === newRank)?.priority;

		if (!GUILD_RANK_PRIO) return logger.info(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: '${target}' was demoted to an unknown rank '${newRank}'`);

		player.guildRankPriority = GUILD_RANK_PRIO;
		player.save();

		return logger.info(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: '${target}' was demoted to '${newRank}'`);
	}

	/**
	 * You joined GUILD_NAME!
	 */
	const guildJoinMatched = message.content.match(/(?<=^You joined ).+(?=!)/);

	if (guildJoinMatched) {
		const [ guildName ] = guildJoinMatched;

		message.client.hypixelGuilds
			.getByName(guildName)
			?.updatePlayers()
			.catch(error => logger.error(`[CHATBRIDGE]: guild update: ${error}`));
		logger.info(`[CHATBRIDGE]: ${message.chatBridge.bot.ign}: joined ${guildName}`);
		return message.chatBridge.link(guildName);
	}

	/**
	 * accept f reqs from guild members
	 * Friend request from [HypixelRank] IGN\n
	 */
	const friendReqMatched = message.content.match(/Friend request from (?:\[.+?\] )?(\w+)/);

	if (friendReqMatched) {
		const [ , IGN ] = friendReqMatched;
		const player = message.client.players.findByIGN(IGN);

		if (!player?.guildID) return logger.info(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: denying f request from ${IGN}`);

		logger.info(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: accepting f request from ${IGN}`);
		return message.chatBridge.minecraft.sendToChat(`/f add ${IGN}`);
	}
};
