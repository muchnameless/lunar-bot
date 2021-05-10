'use strict';

const { stripIndent, oneLine } = require('common-tags');
const { MessageEmbed, Permissions } = require('discord.js');
const jaroWinklerSimilarity = require('jaro-winkler');
const ms = require('ms');
const {	DOUBLE_LEFT_EMOJI, DOUBLE_LEFT_EMOJI_ALT, DOUBLE_RIGHT_EMOJI, DOUBLE_RIGHT_EMOJI_ALT, LEFT_EMOJI, LEFT_EMOJI_ALT, RIGHT_EMOJI, RIGHT_EMOJI_ALT, RELOAD_EMOJI, Y_EMOJI_ALT } = require('../../constants/emojiCharacters');
const { offsetFlags, XP_OFFSETS_TIME, XP_OFFSETS_CONVERTER } = require('../../constants/database');
const { LB_KEY } = require('../../constants/redis');
const { upperCaseFirstChar, autocorrectToOffset, autocorrectToType, removeFlagsFromArray } = require('../util');
const logger = require('../logger');
const cache = require('../../api/cache');

/**
 * @typedef {object} LeaderboardArguments
 * @property {boolean} shouldShowOnlyBelowReqs
 * @property {false|string} hypixelGuildID
 * @property {string|undefined} type
 * @property {{value: string, arg: string}} typeInput
 * @property {string|undefined} offset
 * @property {number} page
 * @property {string} userID
 */

/**
 * @typedef {object} LeaderboardData
 * @property {string} title
 * @property {string} description
 * @property {PlayerData[]} playerData
 * @property {number} playerCount
 * @property {string} playerRequestingEntry
 * @property {number[]} getEntryArgs
 * @property {boolean} isCompetition
 * @property {number} lastUpdatedAt
 */

/**
 * @typedef {object} PlayerData
 * @property {string} ign
 * @property {string} discordID
 * @property {?boolean} [paid]
 * @property {number} sortingStat
 */

/**
 * @typedef {Function} DataConverter
 * @param {import('../../structures/database/models/Player')} player
 * @returns {PlayerData}
 */

/**
 * @typedef {object} CachedLeaderboard
 * @property {LeaderboardArguments} args
 * @property {string} type
 * @property {LeaderboardData} data
 */

/**
 * new page number and reload check
 * @param {number} currentPage the current page
 * @param {string} emojiName the emoji that triggered the page update
 */
function handleReaction(currentPage, emojiName) {
	switch (emojiName) {
		case DOUBLE_LEFT_EMOJI:
		case DOUBLE_LEFT_EMOJI_ALT:
			return {
				page: 1,
				reload: false,
			};

		case LEFT_EMOJI:
		case LEFT_EMOJI_ALT:
			return {
				page: currentPage > 1 ? currentPage - 1 : 1,
				reload: false,
			};

		case RIGHT_EMOJI:
		case RIGHT_EMOJI_ALT:
			return {
				page: currentPage + 1,
				reload: false,
			};

		case DOUBLE_RIGHT_EMOJI:
		case DOUBLE_RIGHT_EMOJI_ALT:
			return {
				page: Infinity,
				reload: false,
			};

		case RELOAD_EMOJI:
			return {
				page: currentPage,
				reload: true,
			};

		default:
			return {
				page: null,
				reload: null,
			};
	}
}


const self = module.exports = {

	/**
	 * getEntry function to turn an element of PlayerData to a lb entry string
	 * @param {import('../../structures/LunarClient')} client
	 * @param {string} leaderboardType
	 * @param {string} statsType
	 * @param {?number} paddingAmount0
	 * @param {?number} paddingAmount1
	 * @param {?number} paddingAmount2
	 */
	getEntry(client, leaderboardType, statsType, paddingAmount0, paddingAmount1, paddingAmount2) {
		switch (leaderboardType) {
			case 'gained':
				switch (statsType) {
					case 'slayer':
						return player => client.formatNumber(player.sortingStat, paddingAmount0);

					case 'skill':
						return player => `${client.formatDecimalNumber(player.skillAverageGain, paddingAmount0)} [${client.formatDecimalNumber(player.trueAverageGain, paddingAmount1)}]`;

					case 'purge':
						return player => `${client.formatDecimalNumber(player.gainedWeight, paddingAmount0)} [${client.formatDecimalNumber(player.totalWeight, paddingAmount1)}]`;

					case 'weight':
						return player => `${client.formatDecimalNumber(player.totalWeightGain, paddingAmount0)} [${client.formatDecimalNumber(player.weightGain, paddingAmount1)} + ${client.formatDecimalNumber(player.overflowGain, paddingAmount2)}]`;

					default:
						return player => client.formatNumber(player.sortingStat, paddingAmount0, Math.round);
				}

			case 'total':
				switch (statsType) {
					case 'slayer':
					case 'zombie':
					case 'spider':
					case 'wolf':
					case 'guild':
						return player => client.formatNumber(player.sortingStat, paddingAmount0);

					case 'skill':
						return player => `${client.formatDecimalNumber(player.skillAverage, paddingAmount0)} [${client.formatDecimalNumber(player.trueAverage, paddingAmount1)}]`;

					case 'purge':
						return player => `${client.formatDecimalNumber(player.gainedWeight, paddingAmount0)} [${client.formatDecimalNumber(player.totalWeight, paddingAmount1)}]`;

					case 'weight':
						return player => `${client.formatDecimalNumber(player.totalWeight, paddingAmount0)} [${client.formatDecimalNumber(player.weight, paddingAmount1)} + ${client.formatDecimalNumber(player.overflow, paddingAmount2)}]`;

					default:
						return player => `${client.formatDecimalNumber(player.progressLevel, paddingAmount0)} [${client.formatNumber(player.xp, paddingAmount1, Math.round)} XP]`;
				}

			default:
				throw new Error(`[GET LB DATA CREATOR]: unsupported type '${leaderboardType}'`);
		}
	},

	/**
	 * adds reactions to navigate in pagination
	 * @param {import('../../structures/extensions/Message')} message the message to add the reactions to
	 */
	async addPageReactions(message) {
		await message.react(DOUBLE_LEFT_EMOJI, LEFT_EMOJI, RIGHT_EMOJI, DOUBLE_RIGHT_EMOJI, RELOAD_EMOJI);
		return message;
	},

	/**
	 * parses leaderboard arguments
	 * @param {import('../../structures/extensions/Message')} message
	 * @param {string[]} rawArgs
	 * @param {string[]} flags
	 * @param {?object} defaults
	 * @param {string} [defaults.typeDefault]
	 * @param {number} [defaults.pageDefault=1]
	 * @returns {Promise<?LeaderboardArguments>}
	 */
	async parseLeaderboardArguments(message, rawArgs, flags, { typeDefault = message.client.config.get('CURRENT_COMPETITION'), pageDefault = 1 } = {}) {
		removeFlagsFromArray(rawArgs);

		const AUTOCORRECT_THRESHOLD = message.client.config.getNumber('AUTOCORRECT_THRESHOLD');

		// should show only below reqs
		const shouldShowOnlyBelowReqsInput = rawArgs
			.map((arg, index) => ({ index, arg, similarity: jaroWinklerSimilarity(arg, 'purge', { caseSensitive: false }) }))
			.sort((a, b) => a.similarity - b.similarity)
			.pop();

		const SHOULD_SHOW_ONLY_BELOW_REQS = shouldShowOnlyBelowReqsInput?.similarity >= AUTOCORRECT_THRESHOLD
			? (() => {
				rawArgs.splice(shouldShowOnlyBelowReqsInput.index, 1);
				return true;
			})()
			: flags.some(flag => [ 'p', 'purge' ].includes(flag));

		// hypixel guild input
		const hypixelGuild = message.client.hypixelGuilds.getFromArray(rawArgs) ?? message.author.player?.guild;

		// type input
		const typeInput = rawArgs
			.map((arg, index) => ({ index, arg, ...autocorrectToType(arg) }))
			.sort((a, b) => a.similarity - b.similarity)
			.pop();

		let type = typeInput?.similarity >= AUTOCORRECT_THRESHOLD
			? (() => {
				rawArgs.splice(typeInput.index, 1);
				return typeInput.value;
			})()
			: null;

		// offset input
		const offsetInput = rawArgs
			.map((arg, index) => ({ index, ...autocorrectToOffset(arg) }))
			.sort((a, b) => a.similarity - b.similarity)
			.pop();
		const offset = offsetInput?.similarity >= AUTOCORRECT_THRESHOLD
			? (() => {
				rawArgs.splice(offsetInput.index, 1);
				return offsetInput.value;
			})()
			: undefined;

		// page input
		let page;

		for (const [ index, arg ] of rawArgs.entries()) {
			const numberInput = parseInt(arg, 10);

			if (Number.isNaN(numberInput)) continue;

			page = Math.max(numberInput, 1);
			rawArgs.splice(index, 1);
			break;
		}

		page ??= pageDefault;

		// type input
		if (rawArgs.length) {
			if (!type) {
				if (!message.client.commands.constructor.force(flags)) {
					const ANSWER = await message.awaitReply(`there is currently no lb for \`${typeInput.arg}\`. Did you mean \`${typeInput.value}\`?`, 30);

					if (!message.client.config.getArray('REPLY_CONFIRMATION').includes(ANSWER?.toLowerCase())) return null;
				}

				rawArgs.splice(typeInput.index, 1);
				type = typeInput.value;
			}
		} else if (!type) {
			type = typeDefault;
		}

		return {
			shouldShowOnlyBelowReqs: SHOULD_SHOW_ONLY_BELOW_REQS || type === 'purge',
			hypixelGuildID: typeof hypixelGuild === 'boolean' ? hypixelGuild : hypixelGuild?.guildID ?? null,
			type,
			typeInput,
			offset,
			page,
			userID: message.author.id,
		};
	},

	/**
	 * creates an embed from the LeaderboardData
	 * @param {import('../../structures/LunarClient')} client
	 * @param {string} leaderboardType
	 * @param {LeaderboardArguments} args
	 * @param {LeaderboardData} param3
	 */
	createLeaderboardEmbed(client, leaderboardType, args, { title, description, playerData, playerCount, playerRequestingEntry, getEntryArgs, isCompetition, lastUpdatedAt }) {
		const { config } = client;
		const ELEMENTS_PER_PAGE = config.getNumber('ELEMENTS_PER_PAGE');
		const PAGES_TOTAL = Math.ceil(playerCount / ELEMENTS_PER_PAGE);
		const PAGE = args.page = Math.max(Math.min(args.page, PAGES_TOTAL), 1);
		const getEntry = self.getEntry(client, leaderboardType, args.type, ...getEntryArgs);

		let playerList = '';

		// get the page elements
		for (let index = Math.max(0, PAGE - 1) * ELEMENTS_PER_PAGE ; index < PAGE * ELEMENTS_PER_PAGE; ++index) {
			if (index < playerCount) {
				const player = playerData[index];
				playerList += `\n${stripIndent`
					#${`${index + 1}`.padStart(3, '0')} : ${player.ign}${isCompetition && player.paid ? ` ${Y_EMOJI_ALT}` : ''}
						 > ${getEntry(player)}
				`}`;
			} else {
				playerList += '\n\u200b\n\u200b';
			}
		}

		return new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle(title)
			.setFooter('Updated at')
			.setDescription(stripIndent`
				${description}
				\`\`\`ada${playerList}\`\`\`
			`)
			.addField(
				playerRequestingEntry
					? 'Your placement'
					: '\u200b',
				stripIndent`
					${playerRequestingEntry ?? ''}
					Page: ${PAGE} / ${PAGES_TOTAL}
				`,
			)
			.setTimestamp(new Date(lastUpdatedAt));
	},

	/**
	 * gets the create[type]LeaderboardData function
	 * @param {string} type
	 */
	getLeaderboardDataCreater(type) {
		switch (type) {
			case 'gained':
				return self.createGainedLeaderboardData;

			case 'total':
				return self.createTotalLeaderboardData;

			default:
				throw new Error(`[GET LB DATA CREATOR]: unsupported type '${type}'`);
		}
	},

	/**
	 * handles a leaderbaord message
	 * @param {import('../../structures/extensions/Message')} message the message to add the reactions to
	 * @param {string[]} rawArgs
	 * @param {string[]} flags
	 * @param {string} leaderboardType
	 * @param {?object} defaults
	 * @param {string} [defaults.typeDefault]
	 * @param {number} [defaults.pageDefault=1]
	 */
	async handleLeaderboardCommandMessage(message, rawArgs, flags, leaderboardType, { typeDefault = message.client.config.get('CURRENT_COMPETITION'), pageDefault = 1 } = {}) {
		const leaderboardArguments = await self.parseLeaderboardArguments(message, rawArgs, flags, { typeDefault, pageDefault });

		if (!leaderboardArguments) return;

		const leaderbaordData = self.getLeaderboardDataCreater(leaderboardType)(message.client, leaderboardArguments);
		const reply = await message.reply(self.createLeaderboardEmbed(message.client, leaderboardType, leaderboardArguments, leaderbaordData));

		await cache.set(
			`${LB_KEY}:${reply.cachingKey}`,
			{ type: leaderboardType, args: leaderboardArguments, data: leaderbaordData },
			message.client.config.getNumber('DATABASE_UPDATE_INTERVAL') * 60_000,
		);
		await self.addPageReactions(reply);

		return reply;
	},

	/**
	 * updates a xp leaderboard message
	 * @param {import('../../structures/extensions/Message')} message leaderboard message to update
	 * @param {import('discord.js').MessageReaction} reaction
	 * @param {import('../../structures/extensions/User')} user
	 */
	async updateLeaderboardMessage(message, reaction, { id: userID }) {
		/** @type {CachedLeaderboard} */
		const cached = await cache.get(`${LB_KEY}:${message.cachingKey}`);

		// edits alredy expired
		if (!cached) return;

		// remove reaction from user
		if (message.channel.checkBotPermissions(Permissions.FLAGS.MANAGE_MESSAGES)) reaction.users.remove(userID).catch(error => logger.error(`[REMOVE REACTION]: ${error}`));

		// user is not command author
		if (userID !== cached.args.userID) return;

		// get new page
		const { page, reload } = handleReaction(cached.args.page, reaction.emoji.name);

		// invalid page emoji
		if (page === null) return;

		// update page
		cached.args.page = page;

		try {
			if (reload) {
				const { type, args } = cached;
				const leaderbaordData = self.getLeaderboardDataCreater(type)(message.client, args);
				const reply = await message.edit(message.content, self.createLeaderboardEmbed(message.client, type, args, leaderbaordData));

				await cache.set(
					`${LB_KEY}:${reply.cachingKey}`,
					{ data: leaderbaordData, ...cached },
					message.client.config.getNumber('DATABASE_UPDATE_INTERVAL') * 60_000,
				);
				await self.addPageReactions(reply);
			} else {
				await message.edit(message.content, self.createLeaderboardEmbed(message.client, cached.type, cached.args, cached.data));
				await cache.set(
					`${LB_KEY}:${message.cachingKey}`,
					cached,
					message.client.config.getNumber('DATABASE_UPDATE_INTERVAL') * 60_000,
				); // update cached page
			}

			if (message.client.config.getBoolean('EXTENDED_LOGGING_ENABLED')) logger.info('[UPDATE LB]: edited xpLeaderboardMessage');
		} catch (error) {
			logger.error(`[UPDATE LB]: ${error}`);
		}
	},

	/**
	 * create gained leaderboard data
	 * @param {import('../../structures/LunarClient')} client
	 * @param {LeaderboardArguments} param1
	 * @returns {LeaderboardData}
	 */
	createGainedLeaderboardData(client, { hypixelGuildID, userID, offset: offsetInput, shouldShowOnlyBelowReqs, type }) {
		const { config } = client;
		const COMPETITION_RUNNING = config.getBoolean('COMPETITION_RUNNING');
		const COMPETITION_END_TIME = config.getNumber('COMPETITION_END_TIME');
		const offset = offsetInput ?? (COMPETITION_RUNNING || (Date.now() - COMPETITION_END_TIME >= 0 && Date.now() - COMPETITION_END_TIME <= 24 * 60 * 60 * 1000)
			? offsetFlags.COMPETITION_START
			: config.get('DEFAULT_XP_OFFSET'));
		const IS_COMPETITION_LB = offset === offsetFlags.COMPETITION_START;
		const SHOULD_USE_COMPETITION_END = !COMPETITION_RUNNING && IS_COMPETITION_LB;
		const CURRENT_OFFSET = SHOULD_USE_COMPETITION_END
			? offsetFlags.COMPETITION_END
			: '';
		const hypixelGuild = (typeof hypixelGuildID === 'string' ? client.hypixelGuilds.cache.get(hypixelGuildID) : hypixelGuildID) ?? (IS_COMPETITION_LB
			? null
			: client.players.getByID(userID)?.guild);

		/** @type {import('../../structures/database/models/Player')[]} */
		let playerDataRaw;

		if (hypixelGuild) {
			playerDataRaw = hypixelGuild.players.array();
			if (shouldShowOnlyBelowReqs) playerDataRaw = playerDataRaw.filter(player => player.getWeight().totalWeight < hypixelGuild.weightReq);
		} else {
			playerDataRaw = client.players.inGuild.array();
			if (shouldShowOnlyBelowReqs) playerDataRaw = playerDataRaw.filter(player => !player.notInGuild && (player.getWeight().totalWeight < player.guild.weightReq));
		}

		const PLAYER_COUNT = playerDataRaw.length;
		const NUMBER_FORMAT = config.get('NUMBER_FORMAT');
		const LAST_UPDATED_AT = SHOULD_USE_COMPETITION_END
			? COMPETITION_END_TIME
			: Math.min(...playerDataRaw.map(({ xpLastUpdatedAt }) => Number(xpLastUpdatedAt)));
		const STARTING_TIME = new Date(config.getNumber(XP_OFFSETS_TIME[offset])).toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

		/** @type {PlayerData[]} */
		let playerData;
		let totalStats;
		let dataConverter;
		let getEntryArgs;
		let title;

		// type specific stuff
		switch (type) {
			case 'slayer': {
				title = 'Slayer XP Gained Leaderboard';
				dataConverter = player => ({
					ign: player.ign,
					discordID: player.discordID,
					paid: player.paid,
					sortingStat: player.getSlayerTotal(CURRENT_OFFSET) - player.getSlayerTotal(offset),
				});
				playerData = playerDataRaw
					.map(dataConverter)
					.sort((a, b) => b.sortingStat - a.sortingStat);
				totalStats = `**${client.formatNumber(playerData.reduce((acc, player) => acc + player.sortingStat, 0), 0, Math.round)}**`;
				getEntryArgs = [ playerData[0]?.sortingStat.toLocaleString(NUMBER_FORMAT).length ];
				break;
			}

			case 'skill': {
				title = 'Skill Average Gained Leaderboard';
				dataConverter = (player) => {
					const { skillAverage, trueAverage } = player.getSkillAverage(CURRENT_OFFSET);
					const { skillAverage: skillAverageOffset, trueAverage: trueAverageOffset } = player.getSkillAverage(offset);
					const skillAverageGain = skillAverage - skillAverageOffset;
					return {
						ign: player.ign,
						discordID: player.discordID,
						paid: player.paid,
						skillAverageGain,
						trueAverageGain: trueAverage - trueAverageOffset,
						sortingStat: skillAverageGain,
					};
				};
				playerData = playerDataRaw
					.map(dataConverter)
					.sort((a, b) => b.sortingStat - a.sortingStat);
				totalStats = `**${(playerData.reduce((acc, player) => acc + player.skillAverageGain, 0) / PLAYER_COUNT).toFixed(2)}** [**${(playerData.reduce((acc, player) => acc + player.trueAverageGain, 0) / PLAYER_COUNT).toFixed(2)}**]`;
				getEntryArgs = [
					Math.floor(playerData[0]?.skillAverageGain).toLocaleString(NUMBER_FORMAT).length,
					Math.floor(Math.max(...playerData.map(({ trueAverageGain }) => trueAverageGain))).toLocaleString(NUMBER_FORMAT).length,
				];
				break;
			}

			case 'purge': {
				title = `${hypixelGuild || ''} Purge List (${config.get('PURGE_LIST_OFFSET')} days interval)`;
				dataConverter = (player) => {
					const { totalWeight } = player.getWeight();
					const startIndex = player.alchemyXpHistory.length - 1 - config.get('PURGE_LIST_OFFSET');
					const { totalWeight: totalWeightOffet } = player.getWeightHistory(player.alchemyXpHistory.findIndex((xp, index) => index >= startIndex && xp !== 0));
					const gainedWeight = totalWeight - totalWeightOffet;
					return {
						ign: player.ign,
						discordID: player.discordID,
						paid: player.paid,
						gainedWeight,
						totalWeight,
						sortingStat: gainedWeight,
					};
				};
				playerData = playerDataRaw
					.map(dataConverter)
					.sort((a, b) => a.totalWeight - b.totalWeight)
					.sort((a, b) => a.sortingStat - b.sortingStat);
				const PADDING_AMOUNT_GAIN = Math.floor(playerData[0]?.gainedWeight).toLocaleString(NUMBER_FORMAT).length;
				const PADDING_AMOUNT_TOTAL = Math.floor(Math.max(...playerData.map(({ totalWeight }) => totalWeight))).toLocaleString(NUMBER_FORMAT).length;
				getEntryArgs = [ PADDING_AMOUNT_GAIN, PADDING_AMOUNT_TOTAL ];
				totalStats = oneLine`
					${client.formatDecimalNumber(playerData.reduce((acc, player) => acc + player.gainedWeight, 0) / PLAYER_COUNT, PADDING_AMOUNT_GAIN)} 
					[${client.formatDecimalNumber(playerData.reduce((acc, player) => acc + player.totalWeight, 0) / PLAYER_COUNT, PADDING_AMOUNT_TOTAL)}]
				`;
				break;
			}

			case 'weight': {
				title = 'Weight Gained Leaderboard';
				dataConverter = (player) => {
					const { weight, overflow, totalWeight } = player.getWeight(CURRENT_OFFSET);
					const { weight: weightOffset, overflow: overflowOffset, totalWeight: totalWeightOffet } = player.getWeight(offset);
					const totalWeightGain = totalWeight - totalWeightOffet;
					return {
						ign: player.ign,
						discordID: player.discordID,
						paid: player.paid,
						weightGain: weight - weightOffset,
						overflowGain: overflow - overflowOffset,
						totalWeightGain,
						sortingStat: totalWeightGain,
					};
				};
				playerData = playerDataRaw
					.map(dataConverter)
					.sort((a, b) => b.sortingStat - a.sortingStat);
				totalStats = oneLine`**${client.formatDecimalNumber(playerData.reduce((acc, player) => acc + player.totalWeightGain, 0) / PLAYER_COUNT)}**
					[**${client.formatDecimalNumber(playerData.reduce((acc, player) => acc + player.weightGain, 0) / PLAYER_COUNT)}** +
					**${client.formatDecimalNumber(playerData.reduce((acc, player) => acc + player.overflowGain, 0) / PLAYER_COUNT)}**]`;
				getEntryArgs = [
					Math.floor(playerData[0]?.totalWeightGain).toLocaleString(NUMBER_FORMAT).length,
					Math.floor(Math.max(...playerData.map(({ weightGain }) => weightGain))).toLocaleString(NUMBER_FORMAT).length,
					Math.floor(Math.max(...playerData.map(({ overflowGain }) => overflowGain))).toLocaleString(NUMBER_FORMAT).length,
				];
				break;
			}

			default: {
				title = {
					zombie: 'Revenant XP Gained Leaderboard',
					spider: 'Tarantula XP Gained Leaderboard',
					wolf: 'Sven XP Gained Leaderboard',
				}[type] ?? `${upperCaseFirstChar(type)} XP Gained Leaderboard`;
				const XP_ARGUMENT = `${type}Xp${CURRENT_OFFSET}`;
				const OFFSET_ARGUMENT = `${type}Xp${offset}`;
				dataConverter = player => ({
					ign: player.ign,
					discordID: player.discordID,
					paid: player.paid,
					sortingStat: player[XP_ARGUMENT] - player[OFFSET_ARGUMENT],
				});
				playerData = playerDataRaw
					.map(dataConverter)
					.sort((a, b) => b.sortingStat - a.sortingStat);
				totalStats = `**${client.formatNumber(playerData.reduce((acc, player) => acc + player.sortingStat, 0), 0, Math.round)}**`;
				getEntryArgs = [ Math.round(playerData[0]?.sortingStat).toLocaleString(NUMBER_FORMAT).length ];
			}
		}

		// description
		let description = '';

		if (type !== 'purge') {
			if (IS_COMPETITION_LB) {
				description += `Start: ${STARTING_TIME} GMT\n`;
				if (COMPETITION_RUNNING) {
					description += `Time left: ${ms(COMPETITION_END_TIME - Date.now(), { long: true })}\n`;
				} else { // competition already ended
					description += `Ended: ${new Date(COMPETITION_END_TIME).toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} GMT\n`;
				}
			} else {
				description += `Tracking xp gained since ${STARTING_TIME} GMT\n`;
			}

			description += `${hypixelGuild?.name ?? 'Guilds'} ${shouldShowOnlyBelowReqs ? 'below reqs' : 'total'} (${PLAYER_COUNT} members): ${totalStats}`;
			title += ` (Current ${upperCaseFirstChar(XP_OFFSETS_CONVERTER[offset])})`;
		} else if (hypixelGuild) { // purge list
			description += stripIndent`
				Current weight requirement: ${client.formatNumber(hypixelGuild.weightReq)}
				Below reqs (${PLAYER_COUNT} / ${hypixelGuild.players.size} members): ${totalStats}
			`;
		} else {
			description += stripIndent`
				Current weight requirements: ${client.hypixelGuilds.cache.map(({ name, weightReq }) => `${name} (${client.formatNumber(weightReq)})`).join(', ')}
				Guilds below reqs (${PLAYER_COUNT} / ${client.players.inGuild.size} members): ${totalStats}
			`;
		}

		// player requesting entry
		const playerRequestingIndex = playerData.findIndex(player => player.discordID === userID);

		let playerRequestingEntry;

		if (playerRequestingIndex !== -1) {
			const playerRequesting = playerData[playerRequestingIndex];

			playerRequestingEntry = stripIndent`
				\`\`\`ada
				#${`${playerRequestingIndex + 1}`.padStart(3, '0')} : ${playerRequesting.ign}${IS_COMPETITION_LB && playerRequesting.paid ? ` ${Y_EMOJI_ALT}` : ''}
					 > ${self.getEntry(client, 'gained', type, ...getEntryArgs)(playerRequesting)}
				\`\`\`
			`;
		} else if (type !== 'purge') {
			let playerRequesting = client.players.getByID(userID);

			// put playerreq into guildplayers and sort then do the above again
			if (playerRequesting) {
				playerRequesting = dataConverter(playerRequesting);
				playerRequestingEntry = stripIndent`
					\`\`\`ada
					#${`${playerData.findIndex(({ sortingStat }) => sortingStat <= playerRequesting.sortingStat) + 1}`.padStart(3, '0')} : ${playerRequesting.ign}${IS_COMPETITION_LB && playerRequesting.paid ? ` ${Y_EMOJI_ALT}` : ''}
						 > ${self.getEntry(client, 'gained', type, ...getEntryArgs)(playerRequesting)}
					\`\`\`
				`;
			} else {
				playerRequestingEntry = stripIndent`
					\`\`\`ada
					#??? : unknown ign
						 > link your discord tag on hypixel
					\`\`\`
				`;
			}
		}

		return {
			title,
			description,
			playerData,
			playerCount: playerData.length,
			playerRequestingEntry,
			getEntryArgs,
			isCompetition: IS_COMPETITION_LB,
			lastUpdatedAt: LAST_UPDATED_AT,
		};
	},

	/**
	 * create total leaderboard data
	 * @param {import('../../structures/LunarClient')} client
	 * @param {LeaderboardArguments} param1
	 * @returns {LeaderboardData}
	 */
	createTotalLeaderboardData(client, { hypixelGuildID, userID, offset = '', shouldShowOnlyBelowReqs, type }) {
		const { config } = client;
		const hypixelGuild = (typeof hypixelGuildID === 'string' ? client.hypixelGuilds.cache.get(hypixelGuildID) : hypixelGuildID) ?? client.players.getByID(userID)?.guild;

		/** @type {import('../../structures/database/models/Player')[]} */
		let playerDataRaw;

		if (hypixelGuild) {
			playerDataRaw = hypixelGuild.players.array();
			if (shouldShowOnlyBelowReqs) playerDataRaw = playerDataRaw.filter(player => player.getWeight().totalWeight < hypixelGuild.weightReq);
		} else {
			playerDataRaw = client.players.inGuild.array();
		}

		const PLAYER_COUNT = playerDataRaw.length;
		const NUMBER_FORMAT = config.get('NUMBER_FORMAT');
		const LAST_UPDATED_AT = offset
			? config.getNumber(XP_OFFSETS_TIME[offset])
			: Math.min(...playerDataRaw.map(({ xpLastUpdatedAt }) => Number(xpLastUpdatedAt)));

		/** @type {PlayerData[]} */
		let playerData;
		let totalStats;
		let dataConverter;
		let getEntryArgs;
		let title;

		// type specific stuff
		switch (type) {
			case 'slayer': {
				title = 'Slayer XP Leaderboard';
				dataConverter = player => ({
					ign: player.ign,
					discordID: player.discordID,
					sortingStat: player.getSlayerTotal(offset),
				});
				playerData = playerDataRaw
					.map(dataConverter)
					.sort((a, b) => b.sortingStat - a.sortingStat);
				totalStats = `**${client.formatNumber(playerData.reduce((acc, player) => acc + player.sortingStat, 0) / PLAYER_COUNT, 0, Math.round)}**`;
				getEntryArgs = [ playerData[0]?.sortingStat.toLocaleString(NUMBER_FORMAT).length ];
				break;
			}

			case 'skill': {
				title = 'Skill Average Leaderboard';
				dataConverter = (player) => {
					const { skillAverage, trueAverage } = player.getSkillAverage(offset);
					return {
						ign: player.ign,
						discordID: player.discordID,
						skillAverage,
						trueAverage,
						sortingStat: skillAverage,
					};
				};
				playerData = playerDataRaw
					.map(dataConverter)
					.sort((a, b) => b.sortingStat - a.sortingStat);
				totalStats = `**${client.formatDecimalNumber(playerData.reduce((acc, player) => acc + player.skillAverage, 0) / PLAYER_COUNT, 2)}** [**${client.formatDecimalNumber(playerData.reduce((acc, player) => acc + player.trueAverage, 0) / PLAYER_COUNT, 2)}**]`;
				getEntryArgs = [ 2, 2 ];
				break;
			}

			case 'zombie':
			case 'spider':
			case 'wolf':
			case 'guild': {
				title = `${{
					zombie: 'Revenant',
					spider: 'Tarantula',
					wolf: 'Sven',
					guild: 'Guild',
				}[type]} XP Leaderboard`;
				const XP_ARGUMENT = `${type}Xp${offset}`;
				dataConverter = player => ({
					ign: player.ign,
					discordID: player.discordID,
					sortingStat: player[XP_ARGUMENT],
				});
				playerData = playerDataRaw
					.map(dataConverter)
					.sort((a, b) => b.sortingStat - a.sortingStat);
				totalStats = `**${client.formatNumber(playerData.reduce((acc, player) => acc + player.sortingStat, 0) / PLAYER_COUNT, 0, Math.round)}**`;
				getEntryArgs = [ playerData[0]?.sortingStat.toLocaleString(NUMBER_FORMAT).length ];
				break;
			}

			case 'weight': {
				title = 'Weight Leaderboard';
				dataConverter = (player) => {
					const { weight, overflow, totalWeight } = player.getWeight(offset);
					return {
						ign: player.ign,
						discordID: player.discordID,
						weight,
						overflow,
						totalWeight,
						sortingStat: totalWeight,
					};
				};
				playerData = playerDataRaw
					.map(dataConverter)
					.sort((a, b) => b.sortingStat - a.sortingStat);
				totalStats = oneLine`
					**${client.formatDecimalNumber(playerData.reduce((acc, player) => acc + player.totalWeight, 0) / PLAYER_COUNT)}**
					[**${client.formatDecimalNumber(playerData.reduce((acc, player) => acc + player.weight, 0) / PLAYER_COUNT)}** + 
					**${client.formatDecimalNumber(playerData.reduce((acc, player) => acc + player.overflow, 0) / PLAYER_COUNT)}**]
				`;
				getEntryArgs = [
					Math.floor(playerData[0]?.totalWeight).toLocaleString(NUMBER_FORMAT).length,
					Math.floor(Math.max(...playerData.map(({ weight }) => weight))).toLocaleString(NUMBER_FORMAT).length,
					Math.floor(Math.max(...playerData.map(({ overflow }) => overflow))).toLocaleString(NUMBER_FORMAT).length,
				];
				break;
			}

			default: {
				title = `${upperCaseFirstChar(type)} LvL Leaderboard`;
				const XP_ARGUMENT = `${type}Xp${offset}`;
				dataConverter = player => ({
					ign: player.ign,
					discordID: player.discordID,
					xp: player[XP_ARGUMENT],
					progressLevel: player.getSkillLevel(type, offset).progressLevel,
					sortingStat: player[XP_ARGUMENT],
				});
				playerData = playerDataRaw
					.map(dataConverter)
					.sort((a, b) => b.sortingStat - a.sortingStat);
				totalStats = `**${(playerData.reduce((acc, player) => acc + player.progressLevel, 0) / PLAYER_COUNT).toFixed(2)}** [**${client.formatNumber(playerData.reduce((acc, player) => acc + player.xp, 0) / PLAYER_COUNT, 0, Math.round)}** XP]`;
				const PADDING_AMOUNT_XP = Math.round(playerData[0]?.xp).toLocaleString(NUMBER_FORMAT).length;
				getEntryArgs = [ 2, PADDING_AMOUNT_XP ];
				break;
			}
		}

		// 'your placement'
		const playerRequestingIndex = playerData.findIndex(player => player.discordID === userID);

		let playerRequestingEntry;

		if (playerRequestingIndex !== -1) {
			const playerRequesting = playerData[playerRequestingIndex];

			playerRequestingEntry = stripIndent`
				\`\`\`ada
				#${`${playerRequestingIndex + 1}`.padStart(3, '0')} : ${playerRequesting.ign}
					 > ${self.getEntry(client, 'total', type, ...getEntryArgs)(playerRequesting)}
				\`\`\`
			`;
		} else {
			let playerRequesting = client.players.getByID(userID);

			// put playerreq into guildplayers and sort then do the above again
			if (playerRequesting) {
				playerRequesting = dataConverter(playerRequesting);
				playerRequestingEntry = stripIndent`
					\`\`\`ada
					#${`${playerData.findIndex(({ sortingStat }) => sortingStat <= playerRequesting.sortingStat) + 1}`.padStart(3, '0')} : ${playerRequesting.ign}
						 > ${self.getEntry(client, 'total', type, ...getEntryArgs)(playerRequesting)}
					\`\`\`
				`;
			} else {
				playerRequestingEntry = stripIndent`
					\`\`\`ada
					#??? : unknown ign
						 > link your discord tag on hypixel
					\`\`\`
				`;
			}
		}

		if (offset) title += ` (Last ${upperCaseFirstChar(XP_OFFSETS_CONVERTER[offset])})`;

		return {
			title,
			description: `${`${hypixelGuild?.name ?? 'Guilds'} ${shouldShowOnlyBelowReqs ? 'below reqs' : 'average'} (${PLAYER_COUNT} members): ${totalStats}`.padEnd(62, '\xa0')}\u200b`,
			playerData,
			playerCount: playerData.length,
			playerRequestingEntry,
			getEntryArgs,
			lastUpdatedAt: LAST_UPDATED_AT,
		};
	},

};
