'use strict';

const ms = require('ms');
const { stripIndent, oneLine } = require('common-tags');
const { MessageEmbed } = require('discord.js');
const {	DOUBLE_LEFT_EMOJI, DOUBLE_LEFT_EMOJI_ALT, DOUBLE_RIGHT_EMOJI, DOUBLE_RIGHT_EMOJI_ALT, LEFT_EMOJI, LEFT_EMOJI_ALT, RIGHT_EMOJI, RIGHT_EMOJI_ALT, RELOAD_EMOJI, Y_EMOJI_ALT } = require('../constants/emojiCharacters');
const { offsetFlags, XP_OFFSETS_SHORT, XP_OFFSETS_TIME, XP_OFFSETS_CONVERTER } = require('../constants/database');
const { upperCaseFirstChar, autocorrect } = require('./util');
const logger = require('../functions/logger');


/**
 * returns a (new) page number or null if the emoji is not a valid page navigation emoji
 * @param {number} currentPage the current page
 * @param {string} emojiName the emoji that triggered the page update
 */
function getPage(currentPage, emojiName) {
	switch (emojiName) {
		case DOUBLE_LEFT_EMOJI:
		case DOUBLE_LEFT_EMOJI_ALT:
			return 1;

		case LEFT_EMOJI:
		case LEFT_EMOJI_ALT:
			return currentPage > 1 ? currentPage - 1 : 1;

		case RIGHT_EMOJI:
		case RIGHT_EMOJI_ALT:
			return currentPage + 1;

		case DOUBLE_RIGHT_EMOJI:
		case DOUBLE_RIGHT_EMOJI_ALT:
			return Infinity;

		case RELOAD_EMOJI:
			return currentPage;

		default:
			return null;
	}
}


const self = module.exports = {

	/**
	 * adds reactions to navigate in pagination
	 * @param {import('../structures/extensions/Message')} message the message to add the reactions to
	 */
	addPageReactions: async message => {
		if (!message) return logger.warn('[ADD PAGE REACTIONS]: no message');
		if (!message.channel.checkBotPermissions('ADD_REACTIONS')) return logger.warn(`[ADD PAGE REACTIONS]: missing 'ADD_REACTIONS' permission in #${message.channel.name}`);

		// add reactions in order
		try {
			await message.react(DOUBLE_LEFT_EMOJI);
			await message.react(LEFT_EMOJI);
			await message.react(RIGHT_EMOJI);
			await message.react(DOUBLE_RIGHT_EMOJI);
			await message.react(RELOAD_EMOJI);
		} catch (error) {
			logger.error(`[ADD PAGE REACTIONS]: ${error.name}: ${error.message}`);
		}
	},

	/**
	 * autocorrect an offset-flag using short names
	 * @param {import('../../structures/database/ConfigHandler')} config the bot's config
	 * @param {string[]} flags message flags
	 * @returns {string}
	 */
	getOffsetFromFlags: (config, flags) => {
		let offset;

		for (const flag of flags) {
			const result = autocorrect(flag, Object.keys(XP_OFFSETS_SHORT));

			if (result.similarity < config.get('AUTOCORRECT_THRESHOLD')) continue;

			offset = XP_OFFSETS_SHORT[result.value];
			break;
		}

		return offset;
	},

	/**
	 * updates a xp leaderboard message
	 * @param {import('../structures/extensions/Message')} message leaderboard message to update
	 * @param {string} emojiName emoji that triggered the update
	 */
	updateLeaderboardMessage: (message, emojiName) => {
		const PAGE_FIELD = message.embeds[0].fields[message.embeds[0].fields.length - 1].value;
		const CURRENT_PAGE = Number(PAGE_FIELD.match(/(\d+) \/ \d+/)[1]);
		const PAGE = getPage(CURRENT_PAGE, emojiName);

		if (!PAGE) return;

		const matchedTitle = message.embeds[0].title.match(/^(?<type>.+?) (?:XP|Xp|LvL|Average)? ?(?<gained>Gained )?Leaderboard(?: \((?:Last|Current) (?<offset>.+)\))?/);

		if (!matchedTitle) return;

		const { content } = message;
		const matchedDescription = message.embeds[0].description.match(/^(?<guildName>.+) (?:total|average|(?<belowReqs>below reqs)) \(/m);
		const GUILD_NAME = matchedDescription.groups.guildName.trim();
		/**
		 * @type {?import('../structures/database/models/HypixelGuild')}
		 */
		const hypixelGuild = GUILD_NAME === 'Guilds'
			? false
			: message.client.hypixelGuilds.getByName(GUILD_NAME);
		const USER_ID = message.guild ? message.mentions.users.first()?.id : message.channel.recipient.id;

		let type = matchedTitle.groups.type.toLowerCase();
		let gained = matchedTitle.groups.gained;

		switch (type) {
			case 'revenant':
				type = 'zombie';
				break;

			case 'tarantula':
				type = 'spider';
				break;

			case 'sven':
				type = 'wolf';
				break;

			case 'weight tracking':
				type = 'track';
				gained = true;
				break;
		}

		const statsEmbed = (gained ? self.createGainedStatsEmbed : self.createTotalStatsEmbed)(message.client, {
			userID: USER_ID,
			hypixelGuild,
			type,
			offset: XP_OFFSETS_CONVERTER[matchedTitle.groups.offset?.toLowerCase()],
			shouldShowOnlyBelowReqs: matchedDescription.groups.belowReqs,
			page: PAGE,
		});

		message.edit(content, statsEmbed);
		if (message.client.config.getBoolean('EXTENDED_LOGGING')) logger.info('[UPDATE LB]: edited xpLeaderboardMessage');
	},

	/**
	 * constructs a xp leaderboard message embed
	 * @param {import('../structures/LunarClient')} client
	 * @param {object} param1
	 * @param {string} param1.userID
	 * @param {import('../structures/database/models/HypixelGuild')} [param1.hypixelGuild]
	 * @param {string} [param1.type]
	 * @param {string} [param1.offset]
	 * @param {boolean} [param1.shouldShowOnlyBelowReqs]
	 * @param {number} [param1.page]
	 */
	createGainedStatsEmbed: (client, { userID, hypixelGuild = null, type, offset, shouldShowOnlyBelowReqs = false, page = 1 }) => {
		const { config } = client;
		const COMPETITION_RUNNING = config.getBoolean('COMPETITION_RUNNING');
		const COMPETITION_END_TIME = config.getNumber('COMPETITION_END_TIME');

		type ??= config.get('CURRENT_COMPETITION');
		offset ??= COMPETITION_RUNNING || (Date.now() - COMPETITION_END_TIME >= 0 && Date.now() - COMPETITION_END_TIME <= 24 * 60 * 60 * 1000)
			? offsetFlags.COMPETITION_START
			: config.get('DEFAULT_XP_OFFSET');

		const IS_COMPETITION_LB = offset === offsetFlags.COMPETITION_START;
		const SHOULD_USE_COMPETITION_END = !COMPETITION_RUNNING && IS_COMPETITION_LB;
		const CURRENT_OFFSET = SHOULD_USE_COMPETITION_END
			? offsetFlags.COMPETITION_END
			: '';

		hypixelGuild ??= IS_COMPETITION_LB
			? null
			: client.players.getByID(userID)?.guild;

		/**
		 * @type {import('../structures/database/models/Player')[]}
		 */
		let guildPlayers;

		if (hypixelGuild) {
			guildPlayers = hypixelGuild.players.array();
			if (shouldShowOnlyBelowReqs) guildPlayers = guildPlayers.filter(player => player.getWeight().totalWeight < hypixelGuild.weightReq);
		} else {
			guildPlayers = client.players.allGuilds.array();
		}

		const PLAYER_COUNT = guildPlayers.length;
		const ELEMENTS_PER_PAGE = config.getNumber('ELEMENTS_PER_PAGE');
		const NUMBER_FORMAT = config.get('NUMBER_FORMAT');
		const PAGES_TOTAL = Math.ceil(PLAYER_COUNT / ELEMENTS_PER_PAGE);
		const LAST_UPDATED_AT = SHOULD_USE_COMPETITION_END
			? COMPETITION_END_TIME
			: Math.min(...guildPlayers.map(player => Number(player.xpLastUpdatedAt)));
		const STARTING_TIME = new Date(config.getNumber(XP_OFFSETS_TIME[offset])).toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
		const embed = new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setFooter('Updated at')
			.setTimestamp(new Date(LAST_UPDATED_AT));

		page = Math.max(Math.min(page, PAGES_TOTAL), 1);

		let totalStats;
		let dataConverter;
		let getEntry;

		switch (type) {
			case 'slayer': {
				embed.setTitle('Slayer XP Gained Leaderboard');
				dataConverter = player => ({
					ign: player.ign,
					discordID: player.discordID,
					paid: player.paid,
					sortingStat: player.getSlayerTotal(CURRENT_OFFSET) - player.getSlayerTotal(offset),
				});
				guildPlayers = guildPlayers
					.map(dataConverter)
					.sort((a, b) => b.sortingStat - a.sortingStat);
				totalStats = `**${client.formatNumber(guildPlayers.reduce((acc, player) => acc + player.sortingStat, 0), 0, Math.round)}**`;
				const PADDING_AMOUNT = guildPlayers[0]?.sortingStat.toLocaleString(NUMBER_FORMAT).length;
				getEntry = player => client.formatNumber(player.sortingStat, PADDING_AMOUNT);
				break;
			}

			case 'skill': {
				embed.setTitle('Skill Average Gained Leaderboard');
				dataConverter = player => {
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
				guildPlayers = guildPlayers
					.map(dataConverter)
					.sort((a, b) => b.sortingStat - a.sortingStat);
				totalStats = `**${(guildPlayers.reduce((acc, player) => acc + player.skillAverageGain, 0) / PLAYER_COUNT).toFixed(2)}** [**${(guildPlayers.reduce((acc, player) => acc + player.trueAverageGain, 0) / PLAYER_COUNT).toFixed(2)}**]`;
				const PADDING_AMOUNT_SA = Math.floor(guildPlayers[0]?.skillAverageGain).toLocaleString(NUMBER_FORMAT).length;
				const PADDING_AMOUNT_TRUE = Math.floor(Math.max(...guildPlayers.map(player => player.trueAverageGain))).toLocaleString(NUMBER_FORMAT).length;
				getEntry = player => `${client.formatDecimalNumber(player.skillAverageGain, PADDING_AMOUNT_SA)} [${client.formatDecimalNumber(player.trueAverageGain, PADDING_AMOUNT_TRUE)}]`;
				break;
			}

			case 'track': {
				embed.setTitle('Weight Tracking Leaderboard');
				dataConverter = player => {
					const { totalWeight } = player.getWeight();
					const { totalWeight: totalWeightOffet } = player.getWeight(offset);
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
				guildPlayers = guildPlayers
					.map(dataConverter)
					.sort((a, b) => b.totalWeight - a.totalWeight)
					.sort((a, b) => b.sortingStat - a.sortingStat);
				const PADDING_AMOUNT_GAIN = Math.floor(guildPlayers[0]?.gainedWeight).toLocaleString(NUMBER_FORMAT).length;
				const PADDING_AMOUNT_TOTAL = Math.floor(Math.max(...guildPlayers.map(player => player.totalWeight))).toLocaleString(NUMBER_FORMAT).length;
				getEntry = player => `${client.formatDecimalNumber(player.gainedWeight, PADDING_AMOUNT_GAIN)} [${client.formatDecimalNumber(player.totalWeight, PADDING_AMOUNT_TOTAL)}]`;
				totalStats = oneLine`
					${client.formatDecimalNumber(guildPlayers.reduce((acc, player) => acc + player.gainedWeight, 0) / PLAYER_COUNT, PADDING_AMOUNT_GAIN)} 
					[${client.formatDecimalNumber(guildPlayers.reduce((acc, player) => acc + player.totalWeight, 0) / PLAYER_COUNT, PADDING_AMOUNT_TOTAL)}]
				`;
				break;
			}

			case 'weight': {
				embed.setTitle('Weight Gained Leaderboard');
				dataConverter = player => {
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
				guildPlayers = guildPlayers
					.map(dataConverter)
					.sort((a, b) => b.sortingStat - a.sortingStat);
				totalStats = oneLine`**${client.formatDecimalNumber(guildPlayers.reduce((acc, player) => acc + player.totalWeightGain, 0) / PLAYER_COUNT)}**
					[**${client.formatDecimalNumber(guildPlayers.reduce((acc, player) => acc + player.weightGain, 0) / PLAYER_COUNT)}** +
					**${client.formatDecimalNumber(guildPlayers.reduce((acc, player) => acc + player.overflowGain, 0) / PLAYER_COUNT)}**]`;
				const PADDING_AMOUNT_TOTAL = Math.floor(guildPlayers[0]?.totalWeightGain).toLocaleString(NUMBER_FORMAT).length;
				const PADDING_AMOUNT_WEIGHT = Math.floor(Math.max(...guildPlayers.map(player => player.weightGain))).toLocaleString(NUMBER_FORMAT).length;
				const PADDING_AMOUNT_OVERFLOW = Math.floor(Math.max(...guildPlayers.map(player => player.overflowGain))).toLocaleString(NUMBER_FORMAT).length;
				getEntry = player => `${client.formatDecimalNumber(player.totalWeightGain, PADDING_AMOUNT_TOTAL)} [${client.formatDecimalNumber(player.weightGain, PADDING_AMOUNT_WEIGHT)} + ${client.formatDecimalNumber(player.overflowGain, PADDING_AMOUNT_OVERFLOW)}]`;
				break;
			}

			default: {
				embed.setTitle({
					zombie: 'Revenant XP Gained Leaderboard',
					spider: 'Tarantula XP Gained Leaderboard',
					wolf: 'Sven XP Gained Leaderboard',
				}[type] ?? `${upperCaseFirstChar(type)} XP Gained Leaderboard`);
				const XP_ARGUMENT = `${type}Xp${CURRENT_OFFSET}`;
				const OFFSET_ARGUMENT = `${type}Xp${offset}`;
				dataConverter = player => ({
					ign: player.ign,
					discordID: player.discordID,
					paid: player.paid,
					sortingStat: player[XP_ARGUMENT] - player[OFFSET_ARGUMENT],
				});
				guildPlayers = guildPlayers
					.map(dataConverter)
					.sort((a, b) => b.sortingStat - a.sortingStat);
				totalStats = `**${client.formatNumber(guildPlayers.reduce((acc, player) => acc + player.sortingStat, 0), 0, Math.round)}**`;
				const PADDING_AMOUNT = Math.round(guildPlayers[0]?.sortingStat).toLocaleString(NUMBER_FORMAT).length;
				getEntry = player => client.formatNumber(player.sortingStat, PADDING_AMOUNT, Math.round);
			}
		}

		let playerList = '';

		// get the page elements
		for (let index = Math.max(0, page - 1) * ELEMENTS_PER_PAGE ; index < page * ELEMENTS_PER_PAGE; ++index) {
			if (index < PLAYER_COUNT) {
				const player = guildPlayers[index];
				playerList += '\n' + stripIndent`
					#${`${index + 1}`.padStart(3, '0')} : ${player.ign}${IS_COMPETITION_LB && player.paid ? ` ${Y_EMOJI_ALT}` : ''}
						 > ${getEntry(player)}
				`;
			} else {
				playerList += '\n\u200b\n\u200b';
			}
		}

		const playerRequestingIndex = guildPlayers.findIndex(player => player.discordID === userID);

		if (playerRequestingIndex !== -1) {
			const playerRequesting = guildPlayers[playerRequestingIndex];

			embed.addField(
				'Your placement',
				stripIndent`
					\`\`\`ada
					#${`${playerRequestingIndex + 1}`.padStart(3, '0')} : ${playerRequesting.ign}${IS_COMPETITION_LB && playerRequesting.paid ? ` ${Y_EMOJI_ALT}` : ''}
					     > ${getEntry(playerRequesting)}
					\`\`\`
					Page: ${page} / ${PAGES_TOTAL}
				`,
			);
		} else {
			let playerRequesting = client.players.getByID(userID);

			// put playerreq into guildplayers and sort then do the above again
			if (playerRequesting) {
				playerRequesting = dataConverter(playerRequesting);

				embed.addField(
					'Your placement',
					stripIndent`
						\`\`\`ada
						#${`${guildPlayers.findIndex(player => player.sortingStat <= playerRequesting.sortingStat) + 1}`.padStart(3, '0')} : ${playerRequesting.ign}${IS_COMPETITION_LB && playerRequesting.paid ? ` ${Y_EMOJI_ALT}` : ''}
						     > ${getEntry(playerRequesting)}
						\`\`\`
						Page: ${page} / ${PAGES_TOTAL}
					`,
				);
			} else {
				embed.addField(
					'Your placement',
					stripIndent`
						\`\`\`ada
						#??? : unknown ign
						     > link your discord tag on hypixel
						\`\`\`
						Page: ${page} / ${PAGES_TOTAL}
					`,
				);
			}
		}

		let description = '';

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

		description += stripIndent`
			${hypixelGuild?.name ?? 'Guilds'} ${shouldShowOnlyBelowReqs ? 'below reqs' : 'total'} (${PLAYER_COUNT} members): ${totalStats}
			\`\`\`ada${playerList}\`\`\`
		`;

		embed.title += ` (Current ${upperCaseFirstChar(XP_OFFSETS_CONVERTER[offset])})`;
		embed.setDescription(description);

		return embed;
	},

	/**
	 * constructs a total xp leaderboard message embed
	 * @param {import('../structures/LunarClient')} client
	 * @param {object} param1
	 * @param {string} param1.userID
	 * @param {import('../structures/database/models/HypixelGuild')} [param1.hypixelGuild]
	 * @param {string} [param1.type]
	 * @param {string} [param1.offset]
	 * @param {boolean} [param1.shouldShowOnlyBelowReqs]
	 * @param {number} [param1.page]
	 */
	createTotalStatsEmbed: (client, { userID, hypixelGuild = null, type, offset = '', shouldShowOnlyBelowReqs = false, page = 1 }) => {
		const { config } = client;

		type ??= config.get('CURRENT_COMPETITION');

		/**
		 * @type {import('../structures/database/models/Player')[]}
		 */
		let guildPlayers;

		if (hypixelGuild) {
			guildPlayers = hypixelGuild.players.array();
			if (shouldShowOnlyBelowReqs) guildPlayers = guildPlayers.filter(player => player.getWeight().totalWeight < hypixelGuild.weightReq);
		} else {
			guildPlayers = client.players.allGuilds.array();
		}
		const PLAYER_COUNT = guildPlayers.length;
		const ELEMENTS_PER_PAGE = config.getNumber('ELEMENTS_PER_PAGE');
		const NUMBER_FORMAT = config.get('NUMBER_FORMAT');
		const PAGES_TOTAL = Math.ceil(PLAYER_COUNT / ELEMENTS_PER_PAGE);
		const LAST_UPDATED_AT = offset
			? config.getNumber(XP_OFFSETS_TIME[offset])
			: Math.min(...guildPlayers.map(player => Number(player.xpLastUpdatedAt)));
		const embed = new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setFooter('Updated at')
			.setTimestamp(new Date(LAST_UPDATED_AT));

		page = Math.max(Math.min(page, PAGES_TOTAL), 1);

		let totalStats;
		let dataConverter;
		let getEntry;

		switch (type) {
			case 'slayer': {
				embed.setTitle('Slayer XP Leaderboard');
				dataConverter = player => ({
					ign: player.ign,
					discordID: player.discordID,
					sortingStat: player.getSlayerTotal(offset),
				});
				guildPlayers = guildPlayers
					.map(dataConverter)
					.sort((a, b) => b.sortingStat - a.sortingStat);
				totalStats = `**${client.formatNumber(guildPlayers.reduce((acc, player) => acc + player.sortingStat, 0) / PLAYER_COUNT, 0, Math.round)}**`;
				const PADDING_AMOUNT = guildPlayers[0]?.sortingStat.toLocaleString(NUMBER_FORMAT).length;
				getEntry = player => client.formatNumber(player.sortingStat, PADDING_AMOUNT);
				break;
			}

			case 'skill': {
				embed.setTitle('Skill Average Leaderboard');
				dataConverter = player => {
					const { skillAverage, trueAverage } = player.getSkillAverage(offset);
					return {
						ign: player.ign,
						discordID: player.discordID,
						skillAverage: skillAverage,
						trueAverage: trueAverage,
						sortingStat: skillAverage,
					};
				};
				guildPlayers = guildPlayers
					.map(dataConverter)
					.sort((a, b) => b.sortingStat - a.sortingStat);
				totalStats = `**${client.formatDecimalNumber(guildPlayers.reduce((acc, player) => acc + player.skillAverage, 0) / PLAYER_COUNT)}** [**${client.formatDecimalNumber(guildPlayers.reduce((acc, player) => acc + player.trueAverage, 0) / PLAYER_COUNT)}**]`;
				getEntry = player => `${client.formatDecimalNumber(player.skillAverage)} [${client.formatDecimalNumber(player.trueAverage)}]`;
				break;
			}

			case 'zombie':
			case 'spider':
			case 'wolf':
			case 'guild': {
				embed.setTitle(`${{
					zombie: 'Revenant',
					spider: 'Tarantula',
					wolf: 'Sven',
				}[type] ?? upperCaseFirstChar(type)} XP Leaderboard`);
				const XP_ARGUMENT = `${type}Xp${offset}`;
				dataConverter = player => ({
					ign: player.ign,
					discordID: player.discordID,
					sortingStat: player[XP_ARGUMENT],
				});
				guildPlayers = guildPlayers
					.map(dataConverter)
					.sort((a, b) => b.sortingStat - a.sortingStat);
				totalStats = `**${client.formatNumber(guildPlayers.reduce((acc, player) => acc + player.sortingStat, 0) / PLAYER_COUNT, 0, Math.round)}**`;
				const PADDING_AMOUNT = guildPlayers[0]?.sortingStat.toLocaleString(NUMBER_FORMAT).length;
				getEntry = player => client.formatNumber(player.sortingStat, PADDING_AMOUNT);
				break;
			}

			case 'weight': {
				embed.setTitle('Weight Leaderboard');
				dataConverter = player => {
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
				guildPlayers = guildPlayers
					.map(dataConverter)
					.sort((a, b) => b.sortingStat - a.sortingStat);
				totalStats = oneLine`
					**${client.formatDecimalNumber(guildPlayers.reduce((acc, player) => acc + player.totalWeight, 0) / PLAYER_COUNT)}**
					[**${client.formatDecimalNumber(guildPlayers.reduce((acc, player) => acc + player.weight, 0) / PLAYER_COUNT)}** + 
					**${client.formatDecimalNumber(guildPlayers.reduce((acc, player) => acc + player.overflow, 0) / PLAYER_COUNT)}**]
				`;
				const PADDING_AMOUNT_TOTAL = Math.floor(guildPlayers[0]?.totalWeight).toLocaleString(NUMBER_FORMAT).length;
				const PADDING_AMOUNT_WEIGHT = Math.floor(Math.max(...guildPlayers.map(player => player.weight))).toLocaleString(NUMBER_FORMAT).length;
				const PADDING_AMOUNT_OVERFLOW = Math.floor(Math.max(...guildPlayers.map(player => player.overflow))).toLocaleString(NUMBER_FORMAT).length;
				getEntry = player => `${client.formatDecimalNumber(player.totalWeight, PADDING_AMOUNT_TOTAL)} [${client.formatDecimalNumber(player.weight, PADDING_AMOUNT_WEIGHT)} + ${client.formatDecimalNumber(player.overflow, PADDING_AMOUNT_OVERFLOW)}]`;
				break;
			}

			default: {
				embed.setTitle(`${upperCaseFirstChar(type)} LvL Leaderboard`);
				const XP_ARGUMENT = `${type}Xp${offset}`;
				dataConverter = player => ({
					ign: player.ign,
					discordID: player.discordID,
					xp: player[XP_ARGUMENT],
					progressLevel: player.getSkillLevel(type, offset).progressLevel,
					sortingStat: player[XP_ARGUMENT],
				});
				guildPlayers = guildPlayers
					.map(dataConverter)
					.sort((a, b) => b.sortingStat - a.sortingStat);
				totalStats = `**${(guildPlayers.reduce((acc, player) => acc + player.progressLevel, 0) / PLAYER_COUNT).toFixed(2)}** [**${client.formatNumber(guildPlayers.reduce((acc, player) => acc + player.xp, 0) / PLAYER_COUNT, 0, Math.round)}** XP]`;
				const PADDING_AMOUNT_XP = Math.round(guildPlayers[0]?.xp).toLocaleString(NUMBER_FORMAT).length;
				getEntry = player => `${client.formatDecimalNumber(player.progressLevel)} [${client.formatNumber(player.xp, PADDING_AMOUNT_XP, Math.round)} XP]`;
				break;
			}
		}

		let playerList = '';

		// get the page elements
		for (let index = (page - 1) * ELEMENTS_PER_PAGE ; index < page * ELEMENTS_PER_PAGE; ++index) {
			if (index < PLAYER_COUNT) {
				const player = guildPlayers[index];
				playerList += '\n' + stripIndent`
					#${`${index + 1}`.padStart(3, '0')} : ${player.ign}
						 > ${getEntry(player)}
				`;
			} else {
				playerList += '\n\u200b\n\u200b';
			}
		}

		// 'your placement'
		const playerRequestingIndex = guildPlayers.findIndex(player => player.discordID === userID);

		if (playerRequestingIndex !== -1) {
			const playerRequesting = guildPlayers[playerRequestingIndex];

			embed.addField(
				'Your placement',
				stripIndent`
					\`\`\`ada
					#${`${playerRequestingIndex + 1}`.padStart(3, '0')} : ${playerRequesting.ign}
					     > ${getEntry(playerRequesting)}
					\`\`\`
					Page: ${page} / ${PAGES_TOTAL}
				`,
			);
		} else {
			let playerRequesting = client.players.getByID(userID);

			// put playerreq into guildplayers and sort then do the above again
			if (playerRequesting) {
				playerRequesting = dataConverter(playerRequesting);

				embed.addField(
					'Your placement',
					stripIndent`
						\`\`\`ada
						#${`${guildPlayers.findIndex(player => player.sortingStat <= playerRequesting.sortingStat) + 1}`.padStart(3, '0')} : ${playerRequesting.ign}
						     > ${getEntry(playerRequesting)}
						\`\`\`
						Page: ${page} / ${PAGES_TOTAL}
					`,
				);
			} else {
				embed.addField(
					'Your placement',
					stripIndent`
						\`\`\`ada
						#??? : unknown ign
						     > link your discord tag on hypixel
						\`\`\`
						Page: ${page} / ${PAGES_TOTAL}
					`,
				);
			}
		}

		if (offset) embed.title += ` (Last ${upperCaseFirstChar(XP_OFFSETS_CONVERTER[offset])})`;
		embed.setDescription(stripIndent`
			${`${hypixelGuild?.name ?? 'Guilds'} ${shouldShowOnlyBelowReqs ? 'below reqs' : 'average'} (${PLAYER_COUNT} members): ${totalStats}`.padEnd(62, '\xa0')}\u200b
			\`\`\`ada${playerList}\`\`\`
		`);

		return embed;
	},

};
