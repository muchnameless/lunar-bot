'use strict';

// const { Constants } = require('discord.js');
const { promisify, inspect } = require('util');
const jaroWinklerSimilarity = require('jaro-winkler');
const hypixel = require('../api/hypixel');
const hypixelAux = require('../api/hypixelAux');
const logger = require('./logger');


const self = module.exports = {

	// usage: await sleep(milliseconds)
	sleep: promisify(setTimeout),

	// lets you insert any string into a regex without escaping it
	escapeRegex: string => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),

	// escapes discord markdown in igns
	escapeIgn: string => string.replace(/_/g, '\\_'),

	// extracts user IDs from @mentions
	getIDFromString: string => string.match(/<@!?(\d+)>/)?.[1] ?? null,

	upperCaseFirstChar: string => `${string.charAt(0).toUpperCase()}${string.slice(1)}`,

	// trims a string to a certain length
	trim: (string, max) => string.length > max ? `${string.slice(0, max - 3)}...` : string,

	// day.month.year -> year/month/day
	reverseDateInput: string => string.split('.').reverse().join('/'),

	// checks the input string if it could be a discord tag
	checkIfDiscordTag: string => /.+#\d{4}/.test(string),

	// returns the aux client instead of the main one if 'shouldSkipQueue' is true and the main client's request queue is filled
	getHypixelClient: (shouldSkipQueue = false) => (shouldSkipQueue && hypixel.queue.promises.length > hypixelAux.queue.promises.length)
		? hypixelAux
		: hypixel,

	// returns the ISO week number of the given date
	getWeekOfYear: date => {
		const target = new Date(date.valueOf());
		const dayNumber = (date.getUTCDay() + 6) % 7;

		target.setUTCDate(target.getUTCDate() - dayNumber + 3);

		const firstThursday = target.valueOf();

		target.setUTCMonth(0, 1);

		if (target.getUTCDay() !== 4) {
			target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
		}

		return Math.ceil((firstThursday - target) / (7 * 24 * 3600 * 1000)) + 1;
	},

	// cleans a string from an embed for console logging
	cleanLoggingEmbedString: string => {
		if (!string || typeof string !== 'string') return null;
		return string.replace(/```(?:js|diff|cs|ada|undefined)?\n/g, '').replace(/`|\*|\n?\u200b/g, '').replace(/\n+/g, '\n');
	},

	// replaces the client's token in 'text' and escapes ` and @mentions
	cleanOutput: (client, text) => {
		if (typeof text !== 'string') text = inspect(text, { depth: 1 });

		return text
			.replace(/`/g, `\`${String.fromCharCode(8203)}`)
			.replace(/@/g, `@${String.fromCharCode(8203)}`)
			.replace(new RegExp(client.token, 'gi'), '****');
	},

	/**
	 * checks the query agains the validInput and returns the most likely match
	 * @param {string} query 
	 * @param {any[]} validInput 
	 * @param {string} attributeToQuery 
	 */
	autocorrect: (query, validInput = [], attributeToQuery = null) => {
		let currentBestElement;
		let currentBestSimilarity = 0;

		for (const element of Array.isArray(validInput) ? validInput : validInput.values()) {
			const similarity = jaroWinklerSimilarity(query, attributeToQuery ? element[attributeToQuery] : element, { caseSensitive: false });

			if (similarity === 1) return {
				value: element,
				similarity,
			};

			if (similarity < currentBestSimilarity) continue;

			currentBestElement = element;
			currentBestSimilarity = similarity;
		}

		logger.info(`[AUTOCORRECT]: autocorrected '${query}' to '${currentBestElement[attributeToQuery] ?? currentBestElement}' with a certainty of ${currentBestSimilarity}`);

		return {
			value: currentBestElement,
			similarity: currentBestSimilarity,
		};
	},

	// removes the provided reaction from the user to a specific message
	removeReaction: async (message, user, emojiName) => {
		if (!message.guild || !self.checkBotPermissions(message.channel, 'MANAGE_MESSAGES')) return; // no perms to remove reactions (in DMs or that channel)

		const reaction = message.reactions.cache.find(r => r.emoji.name === emojiName);

		if (!reaction) return;

		if (!reaction.users.cache.size) await reaction.users.fetch(); // fetch potentially missing users

		if (!reaction.users.cache.has(user.id)) return; // user didn't react with that emoji or has already unreacted themself

		if (await reaction.users.remove(user.id).catch(error => logger.error(`[REMOVE REACTION]: ${error.name}: ${error.message}`)) && message.client.config.getBoolean('EXTENDED_LOGGING'))
			logger.debug(`[REMOVE REACTION]: removed the ${emojiName} reaction from ${user.tag}`);
	},

	// returns an array of required roles for the provided category or null if there are none required
	getRequiredRoles: (category, config) => {
		switch (category) {
			case 'staff':
				return [ config.get('TRIAL_MODERATOR_ROLE_ID'), config.get('MODERATOR_ROLE_ID'), config.get('SENIOR_STAFF_ROLE_ID'), config.get('MANAGER_ROLE_ID') ];

			case 'manager':
				return [ config.get('MANAGER_ROLE_ID') ];

			default:
				if (config.getBoolean('GUILD_PLAYER_ONLY_MODE')) return [ config.get('GUILD_ROLE_ID') ];
				return null;
		}
	},

	// tries to fetch the cronJob message and creates a mock message as replacement in case of an error
	restoreMessage: async (client, cronJob) => {
		const channel = await client.channels.fetch(cronJob.channelID).catch(error => logger.error(`[CRON JOB RESUME]: channel: ${error.name}: ${error.message}`));
		const message = await channel?.messages.fetch(cronJob.messageID).catch(error => logger.error(`[CRON JOB RESUME]: message: ${error.name}: ${error.message}`))
			?? new require('../structureExtensions/lib/Message')(client, {
				// mock 'data'
				id: cronJob.messageID,
				channel: channel,
				content: `${cronJob.name}${cronJob.flags?.length ? ` -${cronJob.flags.join(' -')}` : ''}${cronJob.args?.length ? ` ${cronJob.args.join(' ')}` : ''}`,
				author: await client.users.fetch(cronJob.authorID).catch(error => logger.error(`[CRON JOB RESUME]: user: ${error.name}: ${error.message}`)),
				guild: channel?.guild,
				member: await this.guild?.members.fetch(this.author).catch(error => logger.error(`[CRON JOB RESUME]: member: ${error.name}: ${error.message}`)) ?? null,
			}, channel);

		return message;
	},

	// returns the nearest 'bot-commands'-channel with all required permissions for the bot and the message.member
	findNearestCommandsChannel: (message, requiredChannelPermissions = [ 'VIEW_CHANNEL', 'SEND_MESSAGES' ]) =>
		message.channel.parent.children.find(channel => channel.name.includes('commands') && channel.permissionsFor(message.guild.me).has(requiredChannelPermissions) && channel.permissionsFor(message.member).has([ 'VIEW_CHANNEL', 'SEND_MESSAGES' ]))
			|| message.guild.channels.cache.find(channel => channel.name.includes('bot-commands') && channel.permissionsFor(message.guild.me).has(requiredChannelPermissions) && channel.permissionsFor(message.member).has([ 'VIEW_CHANNEL', 'SEND_MESSAGES' ])),

	// checks wether the bot has the provided permission(s) in the channel
	checkBotPermissions: (channel, permFlag) => {
		if (Array.isArray(permFlag)) return permFlag.every(flag => self.checkBotPermissions(channel, flag));
		if (typeof permFlag !== 'string') return false;

		if (!channel) return false;

		if (channel.type === 'dm' /* Constants.ChannelTypes.DM */) {
			switch (permFlag) {
				case 'ADD_REACTIONS': // add new reactions to messages
				case 'VIEW_CHANNEL':
				case 'SEND_MESSAGES':
				case 'SEND_TTS_MESSAGES':
				case 'EMBED_LINKS': // links posted will have a preview embedded
				case 'ATTACH_FILES':
				case 'READ_MESSAGE_HISTORY': // view messages that were posted prior to opening Discord
				case 'MENTION_EVERYONE':
				case 'USE_EXTERNAL_EMOJIS': // use emojis from different guilds
					return true;

				default:
					return false;
			}
		}

		return channel.permissionsFor?.(channel.guild?.me).has(permFlag) ?? false;
	},

};
