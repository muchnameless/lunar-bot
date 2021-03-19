'use strict';

const {
	promote: { string: { success: promote } },
	demote: { string: { success: demote } },
	mute: { string: { success: mute } },
	unmute: { string: { success: unmute } },
} = require('../constants/commandResponses');
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
	 * auto '/gc welcome'
	 * [HypixelRank] IGN joined the guild!
	 */
	if (message.content.includes('joined the guild')) {
		message.chatBridge.bot.player?.guild?.updatePlayers().catch(error => logger.error(`[CHATBRIDGE]: guild update: ${error.name}: ${error.message}`));
		message.forwardToDiscord();
		return message.chatBridge.broadcast('welcome');
	}

	/**
	 * [HypixelRank] IGN left the guild!
	 */
	if (message.content.includes('left the guild!')) {
		message.chatBridge.bot.player?.guild?.updatePlayers().catch(error => logger.error(`[CHATBRIDGE]: guild update: ${error.name}: ${error.message}`));
		return message.forwardToDiscord();
	}

	/**
	 * You left the guild
	 */
	if (message.content === 'You left the guild') {
		logger.warn(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: bot left the guild`);
		message.chatBridge.bot.player?.guild?.updatePlayers().catch(error => logger.error(`[CHATBRIDGE]: guild update: ${error.name}: ${error.message}`));
		message.forwardToDiscord();
		return message.chatBridge.unlink();
	}

	/**
	 * [HypixelRank] IGN was kicked from the guild by [HypixelRank] IGN!
	 */
	if (message.content.includes('was kicked from the guild by')) {
		message.chatBridge.bot.player?.guild?.updatePlayers().catch(error => logger.error(`[CHATBRIDGE]: guild update: ${error.name}: ${error.message}`));
		return message.forwardToDiscord();
	}

	/**
	 * You were kicked from the guild by [HypixelRank] IGN for reason 'REASON'.
	 */
	if (message.content.startsWith('You were kicked from the guild by')) {
		logger.warn(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: bot was kicked from the guild`);
		message.chatBridge.bot.player?.guild?.updatePlayers().catch(error => logger.error(`[CHATBRIDGE]: guild update: ${error.name}: ${error.message}`));
		message.forwardToDiscord();
		return message.chatBridge.unlink();
	}

	/**
	 * You cannot say the same message twice!
	 */
	if (message.content === 'You cannot say the same message twice!') {
		try {
			await message.chatBridge.client.dmOwner(`${message.chatBridge.logInfo}: anti spam failed: ${message.content}`);
		} catch (error) {
			logger.error(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: error DMing owner anti spam failed`);
		} finally {
			logger.error(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: anti spam failed: ${message.content}`);
		}

		return;
	}

	/**
	 * We blocked your comment "aFate: its because i said the sex word" as it is breaking our rules because it contains inappropriate content with adult themes. http://www.hypixel.net/rules/
	 */
	if (message.content.startsWith('We blocked your comment')) {
		try {
			await message.chatBridge.client.dmOwner(`${message.chatBridge.logInfo}: blocked message: ${message.content}`);
		} catch (error) {
			logger.error(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: error DMing owner blocked message`);
		} finally {
			logger.error(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: blocked message: ${message.content}`);
		}

		return;
	}

	/**
	 * auto '/gc gg' for quest completions
	 * The guild has completed Tier 3 of this week's Guild Quest!
	 * The Guild has reached Level 36!
	 * The Guild has unlocked Winners III!
	 */
	if (/^the guild has (?:completed|reached|unlocked)/i.test(message.content)) {
		message.forwardToDiscord();
		return message.chatBridge.broadcast('gg');
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
		const player = message.chatBridge.client.players.findByIGN(target);

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
		const player = message.chatBridge.client.players.findByIGN(target);

		if (!player?.guildID) return logger.info(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: '${target}' was demoted to '${newRank}' but not in the db`);

		const GUILD_RANK_PRIO = (message.chatBridge.guild ?? player.guild)?.ranks.find(({ name }) => name === newRank)?.priority;

		if (!GUILD_RANK_PRIO) return logger.info(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: '${target}' was demoted to an unknown rank '${newRank}'`);

		player.guildRankPriority = GUILD_RANK_PRIO;
		player.save();

		return logger.info(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: '${target}' was demoted to '${newRank}'`);
	}

	/**
	 * accept f reqs from guild members
	 * Friend request from [HypixelRank] IGN\n
	 */
	const friendReqMatched = message.content.match(/Friend request from (?:\[.+?\] )?(\w+)/);

	if (friendReqMatched) {
		const [ , IGN ] = friendReqMatched;
		const player = message.chatBridge.client.players.findByIGN(IGN);

		if (!player?.guildID) return logger.info(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: denying f request from ${IGN}`);

		logger.info(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: accepting f request from ${IGN}`);
		return message.chatBridge.sendToMinecraftChat(`/f add ${IGN}`);
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

		const player = message.chatBridge.client.players.findByIGN(target);

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

		const player = message.chatBridge.client.players.findByIGN(target);

		if (!player) return;

		player.chatBridgeMutedUntil = 0;
		player.save();

		return logger.info(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: ${target} was unmuted`);
	}

	/**
	 * You joined GUILD_NAME!
	 */
	const guildJoinMatched = message.content.match(/(?<=^You joined ).+(?=!)/);

	if (guildJoinMatched) {
		const [ guildName ] = guildJoinMatched;

		message.chatBridge.client.hypixelGuilds
			.getByName(guildName)
			?.updatePlayers()
			.catch(error => logger.error(`[CHATBRIDGE]: guild update: ${error.name}: ${error.message}`));
		logger.info(`[CHATBRIDGE]: ${message.chatBridge.bot.username}: joined ${guildName}`);
		return message.chatBridge.link(guildName);
	}
};
