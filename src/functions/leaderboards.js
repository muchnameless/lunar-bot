'use strict';

const { stripIndent, oneLine } = require('common-tags');
const { MessageEmbed, MessageActionRow, MessageButton, Constants } = require('discord.js');
const ms = require('ms');
const {	DOUBLE_LEFT_EMOJI, DOUBLE_RIGHT_EMOJI, LEFT_EMOJI, RIGHT_EMOJI, RELOAD_EMOJI, Y_EMOJI_ALT } = require('../constants/emojiCharacters');
const { offsetFlags, XP_OFFSETS_TIME, XP_OFFSETS_CONVERTER, GUILD_ID_ALL } = require('../constants/database');
const { LB_KEY } = require('../constants/redis');
const { upperCaseFirstChar } = require('./util');
const cache = require('../api/cache');
// const logger = require('./logger');

/**
 * @typedef {object} LeaderboardData
 * @property {string} title
 * @property {string} description
 * @property {PlayerData[]} playerData
 * @property {string} playerRequestingEntry
 * @property {Function} getEntry
 * @property {boolean} isCompetition
 * @property {number} lastUpdatedAt
 */

/**
 * @typedef {object} LeaderboardArgs
 * @property {string} lbType
 * @property {string} xpType
 * @property {string} offset
 * @property {import('../structures/database/models/HypixelGuild')} hypixelGuild
 * @property {import('../structures/extensions/User')} user
 * @property {boolean} shouldShowOnlyBelowReqs
 */


/**
 * returns the key for the redis cache
 * @param {LeaderboardArgs} leaderboardArgs
 */
const createCacheKey = ({ user: { id: USER_ID }, hypixelGuild: { guildID = GUILD_ID_ALL }, lbType, xpType, offset, shouldShowOnlyBelowReqs }) => `${LB_KEY}:${USER_ID}:${guildID}:${lbType}:${xpType}:${offset}:${shouldShowOnlyBelowReqs}`;

/**
 * returns a message action row with pagination buttons
 * @param {string} cacheKey
 * @param {number} page
 * @param {number} totalPages
 * @param {boolean} [isExpired=false]
 */
function createActionRow(cacheKey, page, totalPages, isExpired = false) {
	let decDisabled;
	let incDisabled;
	let pageStyle;
	let reloadStyle;

	if (isExpired) {
		decDisabled = true;
		incDisabled = true;
		pageStyle = Constants.MessageButtonStyles.SECONDARY;
		reloadStyle = Constants.MessageButtonStyles.DANGER;
	} else {
		decDisabled = page === 1;
		incDisabled = page === totalPages;
		pageStyle = reloadStyle = Constants.MessageButtonStyles.PRIMARY;
	}

	return new MessageActionRow()
		.addComponents(
			new MessageButton()
				.setCustomID(`${cacheKey}:1`)
				.setEmoji(DOUBLE_LEFT_EMOJI)
				.setStyle(pageStyle)
				.setDisabled(decDisabled),
			new MessageButton()
				.setCustomID(`${cacheKey}:${page - 1}`)
				.setEmoji(LEFT_EMOJI)
				.setStyle(pageStyle)
				.setDisabled(decDisabled),
			new MessageButton()
				.setCustomID(`${cacheKey}:${page + 1}`)
				.setEmoji(RIGHT_EMOJI)
				.setStyle(pageStyle)
				.setDisabled(incDisabled),
			new MessageButton()
				.setCustomID(`${cacheKey}:${totalPages}`)
				.setEmoji(DOUBLE_RIGHT_EMOJI)
				.setStyle(pageStyle)
				.setDisabled(incDisabled),
			new MessageButton()
				.setCustomID(`${cacheKey}:${page}:reload`)
				.setEmoji(RELOAD_EMOJI)
				.setStyle(reloadStyle),
		);
}

const self = module.exports = {

	/**
	 * handles a leaderbaord message
	 * @param {import('../structures/extensions/CommandInteraction')} interaction
	 * @param {string} leaderboardType
	 * @param {LeaderboardArgs & { page: number }} leaderboardArgs
	 */
	async handleLeaderboardCommandInteraction(interaction, leaderboardArgs) {
		const CACHE_KEY = createCacheKey(leaderboardArgs);
		/** @type {?MessageEmbed[]} */
		const embeds = await cache.get(CACHE_KEY)
			?? self.createLeaderboardEmbeds(
				interaction.client,
				self.getLeaderboardDataCreater(leaderboardArgs.lbType)(interaction.client, leaderboardArgs),
			);

		let { page } = leaderboardArgs;

		if (page < 1) {
			page = 1;
		} else if (page > embeds.length) {
			page = embeds.length;
		}

		await interaction.reply({
			embeds: [ embeds[ page - 1 ] ],
			components: [ createActionRow(CACHE_KEY, page, embeds.length) ],
		});

		await cache.set(
			CACHE_KEY,
			embeds.map(embed => embed.toJSON?.() ?? embed),
			interaction.client.config.getNumber('DATABASE_UPDATE_INTERVAL') * 60_000,
		);
	},

	/**
	 * handles a leaderbaord message
	 * @param {import('../structures/extensions/ButtonInteraction')} interaction
	 */
	async handleLeaderboardButtonInteraction(interaction) {
		const [ , USER_ID, HYPIXEL_GUILD_ID, LB_TYPE, XP_TYPE, OFFSET, PURGE, PAGE, IS_RELOAD ] = interaction.customID.split(':');

		if (USER_ID !== interaction.user.id) {
			return interaction.reply({
				content: 'you can only change your own leaderboards',
				ephemeral: true,
			});
		}

		const leaderboardArgs = {
			lbType: LB_TYPE,
			xpType: XP_TYPE,
			offset: OFFSET,
			hypixelGuild: interaction.client.hypixelGuilds.cache.get(HYPIXEL_GUILD_ID),
			user: interaction.user,
			shouldShowOnlyBelowReqs: PURGE === 'true',
		};
		const CACHE_KEY = createCacheKey(leaderboardArgs);
		/** @type {?MessageEmbed[]} */
		const embeds = IS_RELOAD
			? self.createLeaderboardEmbeds(
				interaction.client,
				self.getLeaderboardDataCreater(leaderboardArgs.lbType)(interaction.client, leaderboardArgs),
			)
			: await cache.get(CACHE_KEY);

		let page = Number(PAGE);

		if (!embeds) {
			await interaction.update({
				components: [ createActionRow(CACHE_KEY, page, Infinity, true) ],
			});

			return interaction.reply({
				content: oneLine`
					leaderboard timed out, use ${
						interaction.message
							? `[${RELOAD_EMOJI}](${interaction.message.url ?? `https://discord.com/channels/${interaction.message.guild_id ?? '@me'}/${interaction.message.channel_id}/${interaction.message.id}`})`
							: RELOAD_EMOJI
					} to refresh the data
				`,
				ephemeral: true,
			});
		}

		if (page < 1) {
			page = 1;
		} else if (page > embeds.length) {
			page = embeds.length;
		}

		await interaction.update({
			embeds: [ embeds[ page - 1 ] ],
			components: [ createActionRow(CACHE_KEY, page, embeds.length) ],
		});

		if (IS_RELOAD) await cache.set(
			CACHE_KEY,
			embeds.map(embed => embed.toJSON?.() ?? embed),
			interaction.client.config.getNumber('DATABASE_UPDATE_INTERVAL') * 60_000,
		);
	},

	/**
	 * creates an embed from the LeaderboardData
	 * @param {import('../structures/LunarClient')} client
	 * @param {LeaderboardData} param1
	 */
	createLeaderboardEmbeds(client, { title, description, playerData, playerRequestingEntry, getEntry, isCompetition, lastUpdatedAt }) {
		const { config } = client;
		const ELEMENTS_PER_PAGE = config.getNumber('ELEMENTS_PER_PAGE');
		const PLAYER_COUNT = playerData.length;
		const PAGES_TOTAL = PLAYER_COUNT
			? Math.ceil(PLAYER_COUNT / ELEMENTS_PER_PAGE)
			: 1; // to create at least one page if player list is empty
		const embeds = [];

		for (let page = 1; page <= PAGES_TOTAL; ++page) {
			let playerList = '';

			// get the page elements
			for (let index = Math.max(0, page - 1) * ELEMENTS_PER_PAGE ; index < page * ELEMENTS_PER_PAGE; ++index) {
				if (index < PLAYER_COUNT) {
					const player = playerData[index];
					playerList += `\n${stripIndent`
						#${`${index + 1}`.padStart(3, '0')} : ${player.ign}${isCompetition && player.paid ? ` ${Y_EMOJI_ALT}` : ''}
							 > ${getEntry(player)}
					`}`;
				} else {
					playerList += '\n\u200b\n\u200b';
				}
			}

			embeds.push(new MessageEmbed()
				.setColor(config.get('EMBED_BLUE'))
				.setTitle(title)
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
						Page: ${page} / ${PAGES_TOTAL}
					`,
				)
				.setFooter('Updated at')
				.setTimestamp(lastUpdatedAt),
			);
		}

		return embeds;
	},

	/**
	 * returns the create[type]LeaderboardData function
	 * @param {string} lbType
	 */
	getLeaderboardDataCreater(lbType) {
		switch (lbType) {
			case 'gained':
				return self.createGainedLeaderboardData;

			case 'total':
				return self.createTotalLeaderboardData;

			default:
				throw `unsupported leaderboard type ${lbType}`;
		}
	},

	/**
	 * create gained leaderboard data
	 * @param {import('../structures/LunarClient')} client
	 * @param {LeaderboardArgs} param1
	 * @returns {LeaderboardData}
	 */
	createGainedLeaderboardData(client, { hypixelGuild, user, offset, shouldShowOnlyBelowReqs, xpType }) {
		const { config } = client;
		const COMPETITION_RUNNING = config.getBoolean('COMPETITION_RUNNING');
		const COMPETITION_END_TIME = config.getNumber('COMPETITION_END_TIME');
		const IS_COMPETITION_LB = offset === offsetFlags.COMPETITION_START;
		const SHOULD_USE_COMPETITION_END = !COMPETITION_RUNNING && IS_COMPETITION_LB;
		const CURRENT_OFFSET = SHOULD_USE_COMPETITION_END
			? offsetFlags.COMPETITION_END
			: '';

		/** @type {import('../../structures/database/models/Player')[]} */
		let playerDataRaw;

		if (hypixelGuild !== GUILD_ID_ALL) {
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
		const STARTING_TIME = offset && new Date(config.getNumber(XP_OFFSETS_TIME[offset])).toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

		/** @type {PlayerData[]} */
		let playerData;
		let totalStats;
		let dataConverter;
		let getEntry;
		let title;

		// type specific stuff
		switch (xpType) {
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
				getEntry = player => client.formatNumber(player.sortingStat, playerData[0]?.sortingStat.toLocaleString(NUMBER_FORMAT).length);
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
				getEntry = player => `${client.formatDecimalNumber(player.skillAverageGain, Math.floor(playerData[0]?.skillAverageGain).toLocaleString(NUMBER_FORMAT).length)} [${client.formatDecimalNumber(player.trueAverageGain, Math.floor(Math.max(...playerData.map(({ trueAverageGain }) => trueAverageGain))).toLocaleString(NUMBER_FORMAT).length)}]`;
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
				getEntry = player => `${client.formatDecimalNumber(player.gainedWeight, PADDING_AMOUNT_GAIN)} [${client.formatDecimalNumber(player.totalWeight, PADDING_AMOUNT_TOTAL)}]`;
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
				getEntry = player => `${client.formatDecimalNumber(player.totalWeightGain, Math.floor(playerData[0]?.totalWeightGain).toLocaleString(NUMBER_FORMAT).length)} [${client.formatDecimalNumber(player.weightGain, Math.floor(Math.max(...playerData.map(({ weightGain }) => weightGain))).toLocaleString(NUMBER_FORMAT).length)} + ${client.formatDecimalNumber(player.overflowGain, Math.floor(Math.max(...playerData.map(({ overflowGain }) => overflowGain))).toLocaleString(NUMBER_FORMAT).length)}]`;
				break;
			}

			default: {
				title = `${upperCaseFirstChar(xpType)} XP Gained Leaderboard`;
				const XP_ARGUMENT = `${xpType}Xp${CURRENT_OFFSET}`;
				const OFFSET_ARGUMENT = `${xpType}Xp${offset}`;
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
				getEntry = player => client.formatNumber(player.sortingStat, Math.round(playerData[0]?.sortingStat).toLocaleString(NUMBER_FORMAT).length, Math.round);
			}
		}

		// description
		let description = '';

		if (xpType !== 'purge') {
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
		const playerRequestingIndex = playerData.findIndex(player => player.discordID === user.id);

		let playerRequestingEntry;

		if (playerRequestingIndex !== -1) {
			const playerRequesting = playerData[playerRequestingIndex];

			playerRequestingEntry = stripIndent`
					\`\`\`ada
					#${`${playerRequestingIndex + 1}`.padStart(3, '0')} : ${playerRequesting.ign}${IS_COMPETITION_LB && playerRequesting.paid ? ` ${Y_EMOJI_ALT}` : ''}
						 > ${getEntry(playerRequesting)}
					\`\`\`
				`;
		} else if (xpType !== 'purge') {
			let playerRequesting = user.player;

			// put playerreq into guildplayers and sort then do the above again
			if (playerRequesting) {
				playerRequesting = dataConverter(playerRequesting);
				playerRequestingEntry = stripIndent`
						\`\`\`ada
						#${`${playerData.findIndex(({ sortingStat }) => sortingStat <= playerRequesting.sortingStat) + 1}`.padStart(3, '0')} : ${playerRequesting.ign}${IS_COMPETITION_LB && playerRequesting.paid ? ` ${Y_EMOJI_ALT}` : ''}
							 > ${getEntry(playerRequesting)}
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
			playerRequestingEntry,
			getEntry,
			isCompetition: IS_COMPETITION_LB,
			lastUpdatedAt: LAST_UPDATED_AT,
		};
	},

	/**
	 * create total leaderboard data
	 * @param {import('../structures/LunarClient')} client
	 * @param {LeaderboardArgs} param1
	 * @returns {LeaderboardData}
	 */
	createTotalLeaderboardData(client, { hypixelGuild, user, offset = '', shouldShowOnlyBelowReqs, xpType }) {
		const { config } = client;

		/** @type {import('../../structures/database/models/Player')[]} */
		let playerDataRaw;

		if (hypixelGuild !== GUILD_ID_ALL) {
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
		let getEntry;
		let title;

		// type specific stuff
		switch (xpType) {
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
				getEntry = player => client.formatNumber(player.sortingStat, playerData[0]?.sortingStat.toLocaleString(NUMBER_FORMAT).length);
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
				getEntry = player => `${client.formatDecimalNumber(player.skillAverage, 2)} [${client.formatDecimalNumber(player.trueAverage, 2)}]`;
				break;
			}

			case 'zombie':
			case 'spider':
			case 'wolf':
			case 'enderman':
			case 'guild': {
				title = `${upperCaseFirstChar(xpType)} XP Leaderboard`;
				const XP_ARGUMENT = `${xpType}Xp${offset}`;
				dataConverter = player => ({
					ign: player.ign,
					discordID: player.discordID,
					sortingStat: player[XP_ARGUMENT],
				});
				playerData = playerDataRaw
					.map(dataConverter)
					.sort((a, b) => b.sortingStat - a.sortingStat);
				totalStats = `**${client.formatNumber(playerData.reduce((acc, player) => acc + player.sortingStat, 0) / PLAYER_COUNT, 0, Math.round)}**`;
				getEntry = player => client.formatNumber(player.sortingStat, playerData[0]?.sortingStat.toLocaleString(NUMBER_FORMAT).length);
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
				getEntry = player => `${client.formatDecimalNumber(player.totalWeight, Math.floor(playerData[0]?.totalWeight).toLocaleString(NUMBER_FORMAT).length)} [${client.formatDecimalNumber(player.weight, Math.floor(Math.max(...playerData.map(({ weight }) => weight))).toLocaleString(NUMBER_FORMAT).length)} + ${client.formatDecimalNumber(player.overflow, Math.floor(Math.max(...playerData.map(({ overflow }) => overflow))).toLocaleString(NUMBER_FORMAT).length)}]`;
				break;
			}

			default: {
				title = `${upperCaseFirstChar(xpType)} LvL Leaderboard`;
				const XP_ARGUMENT = `${xpType}Xp${offset}`;
				dataConverter = player => ({
					ign: player.ign,
					discordID: player.discordID,
					xp: player[XP_ARGUMENT],
					progressLevel: player.getSkillLevel(xpType, offset).progressLevel,
					sortingStat: player[XP_ARGUMENT],
				});
				playerData = playerDataRaw
					.map(dataConverter)
					.sort((a, b) => b.sortingStat - a.sortingStat);
				totalStats = `**${(playerData.reduce((acc, player) => acc + player.progressLevel, 0) / PLAYER_COUNT).toFixed(2)}** [**${client.formatNumber(playerData.reduce((acc, player) => acc + player.xp, 0) / PLAYER_COUNT, 0, Math.round)}** XP]`;
				getEntry = player => `${client.formatDecimalNumber(player.progressLevel, 2)} [${client.formatNumber(player.xp, Math.round(playerData[0]?.xp).toLocaleString(NUMBER_FORMAT).length, Math.round)} XP]`;
				break;
			}
		}

		// 'your placement'
		const playerRequestingIndex = playerData.findIndex(player => player.discordID === user.id);

		let playerRequestingEntry;

		if (playerRequestingIndex !== -1) {
			const playerRequesting = playerData[playerRequestingIndex];

			playerRequestingEntry = stripIndent`
					\`\`\`ada
					#${`${playerRequestingIndex + 1}`.padStart(3, '0')} : ${playerRequesting.ign}
						 > ${getEntry(playerRequesting)}
					\`\`\`
				`;
		} else {
			let playerRequesting = user.player;

			// put playerreq into guildplayers and sort then do the above again
			if (playerRequesting) {
				playerRequesting = dataConverter(playerRequesting);
				playerRequestingEntry = stripIndent`
						\`\`\`ada
						#${`${playerData.findIndex(({ sortingStat }) => sortingStat <= playerRequesting.sortingStat) + 1}`.padStart(3, '0')} : ${playerRequesting.ign}
							 > ${getEntry(playerRequesting)}
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
			playerRequestingEntry,
			getEntry,
			lastUpdatedAt: LAST_UPDATED_AT,
		};
	},

};
