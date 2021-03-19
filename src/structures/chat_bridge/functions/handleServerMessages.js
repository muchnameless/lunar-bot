'use strict';

const { stringToMS } = require('../../../functions/util');
const logger = require('../../../functions/logger');


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
	 * auto '/gc gg' for promotions / quest completions
	 * [HypixelRank] IGN was promoted from PREV to NOW
	 * The guild has completed Tier 3 of this week's Guild Quest!
	 * The Guild has reached Level 36!
	 * The Guild has unlocked Winners III!
	 */
	if (message.content.includes('was promoted from') || message.content.startsWith('The guild has completed ') || message.content.startsWith('The Guild has ')) {
		message.forwardToDiscord();
		return message.chatBridge.broadcast('gg');
	}

	/**
	 * [HypixelRank] IGN was demoted from PREV to NOW
	 */
	if (message.content.includes('was demoted from')) {
		return message.forwardToDiscord();
	}

	/**
	 * You cannot say the same message twice!
	 */
	if (message.content === 'You cannot say the same message twice!') {
		return logger.error('[CHATBRIDGE]: anti spam failed');
	}

	/**
	 * We blocked your comment "aFate: its because i said the sex word" as it is breaking our rules because it contains inappropriate content with adult themes. http://www.hypixel.net/rules/
	 */
	if (message.content.startsWith('We blocked your comment')) {
		try {
			const owner = await message.chatBridge.client.users.fetch(message.chatBridge.client.ownerID);
			await owner.send(`${message.chatBridge.logInfo}: blocked message: ${message.content}`, { split: { char: ' ' } });
		} catch (error) {
			logger.error(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: error DMing owner blocked message`);
		} finally {
			logger.error(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: blocked message: ${message.content}`);
		}

		return;
	}

	/**
	 * accept f reqs from guild members
	 * Friend request from [HypixelRank] IGN\n
	 */
	const friendReqMatched = message.content.match(/Friend request from (?:\[.+?\] )?(\w+)/);

	if (friendReqMatched) {
		const [ , IGN ] = friendReqMatched;
		const player = message.chatBridge.client.players.cache.find(({ ign }) => ign === IGN);

		if (!player?.guildID) return logger.info(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: denying f request from ${IGN}`);

		logger.info(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: accepting f request from ${IGN}`);
		return message.chatBridge.sendToMinecraftChat(`/f add ${IGN}`);
	}

	/**
	 * mute
	 * [HypixelRank] IGN has muted [HypixelRank] IGN for 10s
	 * [HypixelRank] IGN has muted the guild chat for 10M
	 */
	const muteMatched = message.content.match(/(?:\[.+?\] )?\w+ has muted (?:\[.+?\] )?(the guild chat|\w+) for (\w+)/);

	if (muteMatched) {
		message.forwardToDiscord();

		const [ , target, duration ] = muteMatched;

		if (target === 'the guild chat') {
			const { guild } = message.chatBridge;
			const msDuration = stringToMS(duration);

			guild.chatMutedUntil = Number.isNaN(msDuration)
				? Infinity
				: Date.now() + msDuration;
			guild.save();

			return logger.info(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: guild chat was muted for ${duration}`);
		}

		const player = message.chatBridge.client.players.cache.find(({ ign }) => ign === target);

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
	const unMuteMatched = message.content.match(/(?:\[.+?\] )?\w+ has unmuted (?:\[.+?\] )?(the guild chat|\w+)/);

	if (unMuteMatched) {
		message.forwardToDiscord();

		const [ , target ] = unMuteMatched;

		if (target === 'the guild chat') {
			const { guild } = message.chatBridge;

			guild.chatMutedUntil = 0;
			guild.save();

			return logger.info(`[CHATBRIDGE]: ${message.chatBridge.logInfo}: guild chat was unmuted`);
		}

		const player = message.chatBridge.client.players.cache.find(({ ign }) => ign === target);

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
