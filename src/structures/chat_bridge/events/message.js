'use strict';

const ms = require('ms');
const logger = require('../../../functions/logger');


/**
 * @param {import('../ChatBridge')} chatBridge
 * @param {import('../HypixelMessage')} message
 */
module.exports = async (chatBridge, message) => {
	if (chatBridge.client.config.getBoolean('EXTENDED_LOGGING')) logger.debug(`[${message.position}]: ${message.rawContent}`);

	if (!chatBridge.guild) {
		/**
		 * You joined GUILD_NAME!
		 */
		const guildJoinMatched = message.content.match(/(?<=^You joined ).+(?=!)/);

		if (guildJoinMatched) {
			const [ guildName ] = guildJoinMatched;

			logger.info(`[CHATBRIDGE]: ${chatBridge.bot.username}: joined ${guildName}`);
			return chatBridge.link(guildName);
		}

		return;
	}

	if (!chatBridge.guild.chatBridgeEnabled) return;
	if (!message.rawContent.length) return;

	switch (message.type) {
		case 'guild': {
			if (message.author.ign === chatBridge.bot.username) return; // ignore own messages
			if (!chatBridge.ready) return logger.warn(`[CHATBRIDGE MESSAGE]: ${chatBridge.logInfo}: webhook unavailable`);

			return message.forwardToDiscord();
		}

		case 'whisper': {
			if (chatBridge.client.config.getBoolean('EXTENDED_LOGGING')) logger.debug(`[CHATBRIDGE MESSAGE]: ${chatBridge.logInfo}: whisper from ${message.author.ign}`);

			// auto 'o/' reply
			if (/\( ﾟ◡ﾟ\)\/|o\//.test(message.content)) return message.author.send('o/');

			if (!chatBridge.ready) return logger.warn(`[CHATBRIDGE MESSAGE]: ${chatBridge.logInfo}: webhook unavailable`);

			return;
		}

		default: {
			/**
			 * auto '/gc welcome'
			 * [HypixelRank] IGN joined the guild!
			 */
			if (message.content.includes('joined the guild')) {
				await message.forwardToDiscord();
				return chatBridge.broadcast('welcome');
			}

			/**
			 * [HypixelRank] IGN left the guild!
			 */
			if (message.content.includes('left the guild!')) {
				return message.forwardToDiscord();
			}

			/**
			 * You left the guild
			 */
			if (message.content === 'You left the guild') {
				logger.warn(`[CHATBRIDGE]: ${chatBridge.logInfo}: bot left the guild`);
				await message.forwardToDiscord();
				return chatBridge.unlink();
			}

			/**
			 * [HypixelRank] IGN was kicked from the guild by [HypixelRank] IGN!
			 */

			if (message.content.includes('was kicked from the guild by')) {
				return message.forwardToDiscord();
			}

			/**
			 * You were kicked from the guild by [HypixelRank] IGN for reason 'REASON'.
			 */
			if (message.content.startsWith('You were kicked from the guild by')) {
				logger.warn(`[CHATBRIDGE]: ${chatBridge.logInfo}: bot was kicked from the guild`);
				await message.forwardToDiscord();
				return chatBridge.unlink();
			}

			/**
			 * auto '/gc gg' for promotions / quest completions
			 * [HypixelRank] IGN was promoted from PREV to NOW
			 * The guild has completed Tier 3 of this week's Guild Quest!
			 */
			if (message.content.includes('was promoted from') || message.content.startsWith('The guild has completed ')) {
				await message.forwardToDiscord();
				return chatBridge.broadcast('gg');
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
				const player = chatBridge.client.players.cache.find(p => p.ign === ign);

				if (!player?.guildID) return logger.info(`[CHATBRIDGE MESSAGE]: ${chatBridge.logInfo}: denying f request from ${ign}`);

				logger.info(`[CHATBRIDGE MESSAGE]: ${chatBridge.logInfo}: accepting f request from ${ign}`);
				return chatBridge.sendToMinecraftChat(`/f add ${ign}`);
			}

			/**
			 * auto chatBridge mute
			 * [HypixelRank] IGN has muted [HypixelRank] IGN for 10s
			 * [HypixelRank] IGN has muted the guild chat for 10M
			 */
			const muteMatched = message.content.match(/(?:\[.+?\] )?\w+ has muted (?:\[.+?\] )?(the guild chat|\w+) for (\w+)/);

			if (muteMatched) {
				message.forwardToDiscord();

				const [, target, duration ] = muteMatched;

				if (target === 'the guild chat') {
					const guild = chatBridge.guild;

					guild.chatMutedUntil = Date.now() + ms(duration);
					guild.save();

					return logger.info(`[CHATBRIDGE MESSAGE]: ${chatBridge.logInfo}: guild chat was muted for ${duration}`);
				}

				const player = chatBridge.client.players.cache.find(p => p.ign === target);

				if (!player) return;

				const msDuration = ms(duration);

				if (!msDuration) return;

				player.chatBridgeMutedUntil = Date.now() + msDuration;
				player.save();

				return logger.info(`[CHATBRIDGE MESSAGE]: ${chatBridge.logInfo}: ${target} was muted for ${duration}`);
			}

			/**
			 * auto chatBridge unmute
			 * [HypixelRank] IGN has unmuted [HypixelRank] IGN
			 * [HypixelRank] IGN has unmuted the guild chat!
			 */
			const unMuteMatched = message.content.match(/(?:\[.+?\] )?\w+ has unmuted (?:\[.+?\] )?(the guild chat|\w+)/);

			if (unMuteMatched) {
				message.forwardToDiscord();

				const [, target ] = unMuteMatched;

				if (target === 'the guild chat') {
					const guild = chatBridge.guild;

					guild.chatMutedUntil = 0;
					guild.save();

					return logger.info(`[CHATBRIDGE MESSAGE]: ${chatBridge.logInfo}: guild chat was unmuted`);
				}

				const player = chatBridge.client.players.cache.find(p => p.ign === target);

				if (!player) return;

				player.chatBridgeMutedUntil = 0;
				player.save();

				return logger.info(`[CHATBRIDGE MESSAGE]: ${chatBridge.logInfo}: ${target} was unmuted`);
			}
		}
	}
};
