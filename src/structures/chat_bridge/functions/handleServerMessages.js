'use strict';

const ms = require('ms');
const logger = require('../../../functions/logger');


/**
 * handles a hypixel server message (non user message)
 * @param {import('../HypixelMessage')} message
 */
module.exports = async message => {
	/**
	 * auto '/gc welcome'
	 * [HypixelRank] IGN joined the guild!
	 */
	if (message.content.includes('joined the guild')) {
		message.chatBridge.bot.player?.guild?.updatePlayers().catch(error => logger.error(`[message.chatBridge]: guild update: ${error.name}: ${error.message}`));
		await message.forwardToDiscord();
		return message.chatBridge.broadcast('welcome');
	}

	/**
	 * [HypixelRank] IGN left the guild!
	 */
	if (message.content.includes('left the guild!')) {
		message.chatBridge.bot.player?.guild?.updatePlayers().catch(error => logger.error(`[message.chatBridge]: guild update: ${error.name}: ${error.message}`));
		return message.forwardToDiscord();
	}

	/**
	 * You left the guild
	 */
	if (message.content === 'You left the guild') {
		logger.warn(`[message.chatBridge]: ${message.chatBridge.logInfo}: bot left the guild`);
		message.chatBridge.bot.player?.guild?.updatePlayers().catch(error => logger.error(`[message.chatBridge]: guild update: ${error.name}: ${error.message}`));
		await message.forwardToDiscord();
		return message.chatBridge.unlink();
	}

	/**
	 * [HypixelRank] IGN was kicked from the guild by [HypixelRank] IGN!
	 */
	if (message.content.includes('was kicked from the guild by')) {
		message.chatBridge.bot.player?.guild?.updatePlayers().catch(error => logger.error(`[message.chatBridge]: guild update: ${error.name}: ${error.message}`));
		return message.forwardToDiscord();
	}

	/**
	 * You were kicked from the guild by [HypixelRank] IGN for reason 'REASON'.
	 */
	if (message.content.startsWith('You were kicked from the guild by')) {
		logger.warn(`[message.chatBridge]: ${message.chatBridge.logInfo}: bot was kicked from the guild`);
		message.chatBridge.bot.player?.guild?.updatePlayers().catch(error => logger.error(`[message.chatBridge]: guild update: ${error.name}: ${error.message}`));
		await message.forwardToDiscord();
		return message.chatBridge.unlink();
	}

	/**
	 * auto '/gc gg' for promotions / quest completions
	 * [HypixelRank] IGN was promoted from PREV to NOW
	 * The guild has completed Tier 3 of this week's Guild Quest!
	 * The Guild has reached Level 36!
	 */
	if (message.content.includes('was promoted from') || message.content.startsWith('The guild has completed ') || message.content.startsWith('The Guild has reached Level')) {
		await message.forwardToDiscord();
		return message.chatBridge.broadcast('gg');
	}

	/**
	 * [HypixelRank] IGN was demoted from PREV to NOW
	 */
	if (message.content.includes('was demoted from')) {
		return message.forwardToDiscord();
	}

	/**
	 * accept f reqs from guild members
	 * Friend request from [HypixelRank] IGN\n
	 */
	const friendReqMatched = message.content.match(/Friend request from (?:\[.+?\] )?(\w+)/);

	if (friendReqMatched) {
		const [, ign ] = friendReqMatched;
		const player = message.chatBridge.client.players.cache.find(p => p.ign === ign);

		if (!player?.guildID) return logger.info(`[message.chatBridge MESSAGE]: ${message.chatBridge.logInfo}: denying f request from ${ign}`);

		logger.info(`[message.chatBridge MESSAGE]: ${message.chatBridge.logInfo}: accepting f request from ${ign}`);
		return message.chatBridge.sendToMinecraftChat(`/f add ${ign}`);
	}

	/**
	 * mute
	 * [HypixelRank] IGN has muted [HypixelRank] IGN for 10s
	 * [HypixelRank] IGN has muted the guild chat for 10M
	 */
	const muteMatched = message.content.match(/(?:\[.+?\] )?\w+ has muted (?:\[.+?\] )?(the guild chat|\w+) for (\w+)/);

	if (muteMatched) {
		message.forwardToDiscord();

		const [, target, duration ] = muteMatched;

		if (target === 'the guild chat') {
			const guild = message.chatBridge.guild;

			guild.chatMutedUntil = Date.now() + ms(duration);
			guild.save();

			return logger.info(`[message.chatBridge MESSAGE]: ${message.chatBridge.logInfo}: guild chat was muted for ${duration}`);
		}

		const player = message.chatBridge.client.players.cache.find(p => p.ign === target);

		if (!player) return;

		const msDuration = ms(duration);

		if (!msDuration) return;

		player.message.chatBridgeMutedUntil = Date.now() + msDuration;
		player.save();

		return logger.info(`[message.chatBridge MESSAGE]: ${message.chatBridge.logInfo}: ${target} was muted for ${duration}`);
	}

	/**
	 * unmute
	 * [HypixelRank] IGN has unmuted [HypixelRank] IGN
	 * [HypixelRank] IGN has unmuted the guild chat!
	 */
	const unMuteMatched = message.content.match(/(?:\[.+?\] )?\w+ has unmuted (?:\[.+?\] )?(the guild chat|\w+)/);

	if (unMuteMatched) {
		message.forwardToDiscord();

		const [, target ] = unMuteMatched;

		if (target === 'the guild chat') {
			const guild = message.chatBridge.guild;

			guild.chatMutedUntil = 0;
			guild.save();

			return logger.info(`[message.chatBridge MESSAGE]: ${message.chatBridge.logInfo}: guild chat was unmuted`);
		}

		const player = message.chatBridge.client.players.cache.find(p => p.ign === target);

		if (!player) return;

		player.message.chatBridgeMutedUntil = 0;
		player.save();

		return logger.info(`[message.chatBridge MESSAGE]: ${message.chatBridge.logInfo}: ${target} was unmuted`);
	}
};
