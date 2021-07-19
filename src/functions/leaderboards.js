'use strict';

const { MessageEmbed, MessageActionRow, MessageButton, MessageSelectMenu, Formatters, Constants } = require('discord.js');
const { stripIndent, oneLine } = require('common-tags');
const {	DOUBLE_LEFT_EMOJI, DOUBLE_RIGHT_EMOJI, LEFT_EMOJI, RIGHT_EMOJI, RELOAD_EMOJI, Y_EMOJI_ALT } = require('../constants/emojiCharacters');
const { offsetFlags, XP_OFFSETS_TIME, XP_OFFSETS_SHORT, XP_OFFSETS_CONVERTER, GUILD_ID_ALL } = require('../constants/database');
const { skills, cosmeticSkills, slayers, dungeonTypes, dungeonClasses } = require('../constants/skyblock');
const { LB_KEY } = require('../constants/redis');
const { upperCaseFirstChar, timestampToDateMarkdown } = require('./util');
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
 * @property {import('../structures/database/models/HypixelGuild') | GUILD_ID_ALL} hypixelGuild
 * @property {import('../structures/extensions/User')} user
 */


/**
 * returns the key for the redis cache
 * @param {LeaderboardArgs} leaderboardArgs
 */
const createCacheKey = ({ user: { id: USER_ID }, hypixelGuild: { guildId = GUILD_ID_ALL }, lbType, xpType, offset }) => `${LB_KEY}:${USER_ID}:${guildId}:${lbType}:${xpType}:${offset}`;

/**
 * returns a message action row with pagination buttons
 * @param {import('../structures/LunarClient')} client
 * @param {string} cacheKey
 * @param {LeaderboardArgs} leaderboardArgs
 * @param {number} totalPages
 * @param {boolean} [isExpired=false]
 */
function createActionRows(client, cacheKey, { page, lbType, xpType, offset, hypixelGuild }, totalPages, isExpired = false) {
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

	const row = [];
	const guildSelectMenu = new MessageSelectMenu()
		.setCustomId(`${cacheKey}:guild`)
		.setPlaceholder(
			hypixelGuild !== GUILD_ID_ALL
				? `Guild: ${hypixelGuild.name}`
				: 'Guilds: All',
		)
		.addOptions(
			client.hypixelGuilds.cache.map(({ guildId, name }) => ({ label: name, value: guildId })),
			{ label: 'All', value: GUILD_ID_ALL },
		);

	if (xpType !== 'purge') {
		const offsetSelectMenu = new MessageSelectMenu()
			.setCustomId(`${cacheKey}:offset`)
			.setPlaceholder(
				`Offset: ${upperCaseFirstChar(XP_OFFSETS_CONVERTER[offset] ?? 'None')}`,
			)
			.addOptions(
				Object.keys(XP_OFFSETS_SHORT).map(x => ({ label: upperCaseFirstChar(x), value: XP_OFFSETS_CONVERTER[x] })),
			);

		if (lbType === 'total') offsetSelectMenu.addOptions({ label: 'None', value: 'none' });

		row.push(
			new MessageActionRow()
				.addComponents(
					new MessageSelectMenu()
						.setCustomId(`${cacheKey}:lbType`)
						.setPlaceholder(
							`Lb Type: ${upperCaseFirstChar(lbType)}`,
						)
						.addOptions(
							{ label: 'Total XP', value: 'total' },
							{ label: 'Gained XP', value: 'gained' },
						),
				),
			new MessageActionRow()
				.addComponents(
					new MessageSelectMenu()
						.setCustomId(`${cacheKey}:xpType`)
						.setPlaceholder(
							`XP Type: ${xpType
								.split('-')
								.map(x => upperCaseFirstChar(x))
								.join(' ')}`,
						)
						.addOptions(
							[ 'weight', { label: 'Skill Average', value: 'skill-average' }, ...skills, ...cosmeticSkills, 'slayer', ...slayers, ...dungeonTypes, ...dungeonClasses, 'guild' ]
								.map(x => (typeof x !== 'object' ? ({ label: upperCaseFirstChar(x), value: x }) : x)),
						),
				),
			new MessageActionRow()
				.addComponents(
					offsetSelectMenu,
				),
		);
	}

	row.push(
		new MessageActionRow()
			.addComponents(
				guildSelectMenu,
			),
		new MessageActionRow()
			.addComponents(
				new MessageButton()
					.setCustomId(`${cacheKey}:1`)
					.setEmoji(DOUBLE_LEFT_EMOJI)
					.setStyle(pageStyle)
					.setDisabled(decDisabled),
				new MessageButton()
					.setCustomId(`${cacheKey}:${page - 1}`)
					.setEmoji(LEFT_EMOJI)
					.setStyle(pageStyle)
					.setDisabled(decDisabled),
				new MessageButton()
					.setCustomId(`${cacheKey}:${page + 1}`)
					.setEmoji(RIGHT_EMOJI)
					.setStyle(pageStyle)
					.setDisabled(incDisabled),
				new MessageButton()
					.setCustomId(`${cacheKey}:${totalPages}`)
					.setEmoji(DOUBLE_RIGHT_EMOJI)
					.setStyle(pageStyle)
					.setDisabled(incDisabled),
				new MessageButton()
					.setCustomId(`${cacheKey}:${page}:reload`)
					.setEmoji(RELOAD_EMOJI)
					.setStyle(reloadStyle),
			),
	);

	return row;
}

const self = module.exports = {

	/**
	 * default xp offset based on wether there is a current competition or not
	 * @param {import('../structures/database/managers/ConfigManager')} config
	 * @returns {string}
	 */
	getDefaultOffset(config) {
		return (config.get('COMPETITION_RUNNING') || (Date.now() - config.get('COMPETITION_END_TIME') >= 0 && Date.now() - config.get('COMPETITION_END_TIME') <= 24 * 60 * 60 * 1_000)
			? offsetFlags.COMPETITION_START
			: config.get('DEFAULT_XP_OFFSET'));
	},

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

		if (leaderboardArgs.page < 1) {
			leaderboardArgs.page = 1;
		} else if (leaderboardArgs.page > embeds.length) {
			leaderboardArgs.page = embeds.length;
		}

		await interaction.reply({
			embeds: [ embeds[ leaderboardArgs.page - 1 ] ],
			components: createActionRows(interaction.client, CACHE_KEY, leaderboardArgs, embeds.length),
		});

		await cache.set(
			CACHE_KEY,
			embeds.map(embed => embed.toJSON?.() ?? embed),
			interaction.client.config.get('DATABASE_UPDATE_INTERVAL') * 60_000,
		);
	},

	/**
	 * handles a leaderbaord message
	 * @param {import('../structures/extensions/ButtonInteraction')} interaction
	 */
	async handleLeaderboardButtonInteraction(interaction) {
		const [ , USER_ID, HYPIXEL_GUILD_ID, LB_TYPE, XP_TYPE, OFFSET, PAGE, IS_RELOAD ] = interaction.customId.split(':');
		/** @type {LeaderboardArgs} */
		const leaderboardArgs = {
			lbType: LB_TYPE,
			xpType: XP_TYPE,
			offset: OFFSET,
			hypixelGuild: HYPIXEL_GUILD_ID !== GUILD_ID_ALL
				? interaction.client.hypixelGuilds.cache.get(HYPIXEL_GUILD_ID)
				: HYPIXEL_GUILD_ID,
			user: interaction.user,
			page: Number(PAGE),
		};

		if (USER_ID !== interaction.user.id) {
			return self.handleLeaderboardCommandInteraction(interaction, { page: 1, ...leaderboardArgs });
		}

		const CACHE_KEY = createCacheKey(leaderboardArgs);
		/** @type {?MessageEmbed[]} */
		const embeds = IS_RELOAD
			? self.createLeaderboardEmbeds(
				interaction.client,
				self.getLeaderboardDataCreater(leaderboardArgs.lbType)(interaction.client, leaderboardArgs),
			)
			: await cache.get(CACHE_KEY);

		if (!embeds) {
			await interaction.update({
				components: createActionRows(interaction.client, CACHE_KEY, leaderboardArgs, Infinity, true),
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

		if (leaderboardArgs.page < 1) {
			leaderboardArgs.page = 1;
		} else if (leaderboardArgs.page > embeds.length) {
			leaderboardArgs.page = embeds.length;
		}

		await interaction.update({
			embeds: [ embeds[ leaderboardArgs.page - 1 ] ],
			components: createActionRows(interaction.client, CACHE_KEY, leaderboardArgs, embeds.length),
		});

		if (IS_RELOAD) await cache.set(
			CACHE_KEY,
			embeds.map(embed => embed.toJSON?.() ?? embed),
			interaction.client.config.get('DATABASE_UPDATE_INTERVAL') * 60_000,
		);
	},

	/**
	 * handles a leaderbaord message
	 * @param {import('../structures/extensions/SelectMenuInteraction')} interaction
	 */
	async handleLeaderboardSelectMenuInteraction(interaction) {
		const [ , USER_ID, HYPIXEL_GUILD_ID, LB_TYPE, XP_TYPE, OFFSET, SELECT_TYPE ] = interaction.customId.split(':');
		/** @type {LeaderboardArgs} */
		const leaderboardArgs = {
			lbType: LB_TYPE,
			xpType: XP_TYPE,
			offset: OFFSET,
			hypixelGuild: HYPIXEL_GUILD_ID !== GUILD_ID_ALL
				? interaction.client.hypixelGuilds.cache.get(HYPIXEL_GUILD_ID)
				: HYPIXEL_GUILD_ID,
			user: interaction.user,
			page: 1,
		};

		switch (SELECT_TYPE) {
			case 'lbType':
				[ leaderboardArgs.lbType ] = interaction.values;

				// reset offsets to defaults
				switch (leaderboardArgs.lbType) {
					case 'gained':
						leaderboardArgs.offset = self.getDefaultOffset(interaction.client.config);
						break;

					case 'total':
						leaderboardArgs.offset = '';
						break;
				}
				break;

			case 'offset': {
				const [ OFFSET_SELECT ] = interaction.values;
				leaderboardArgs.offset = OFFSET_SELECT !== 'none'
					? OFFSET_SELECT
					: '';
				break;
			}

			case 'guild': {
				const [ HYPIXEL_GUILD_ID_SELECT ] = interaction.values;
				leaderboardArgs.hypixelGuild = HYPIXEL_GUILD_ID_SELECT !== GUILD_ID_ALL
					? interaction.client.hypixelGuilds.cache.get(HYPIXEL_GUILD_ID_SELECT)
					: GUILD_ID_ALL;
				break;
			}

			default:
				[ leaderboardArgs[SELECT_TYPE] ] = interaction.values;
		}

		if (USER_ID !== interaction.user.id) {
			return self.handleLeaderboardCommandInteraction(interaction, { page: 1, ...leaderboardArgs });
		}

		const CACHE_KEY = createCacheKey(leaderboardArgs);
		/** @type {?MessageEmbed[]} */
		const embeds = await cache.get(CACHE_KEY)
			?? self.createLeaderboardEmbeds(
				interaction.client,
				self.getLeaderboardDataCreater(leaderboardArgs.lbType)(interaction.client, leaderboardArgs),
			);

		await interaction.update({
			embeds: [ embeds[ leaderboardArgs.page - 1 ] ],
			components: createActionRows(interaction.client, CACHE_KEY, leaderboardArgs, embeds.length),
		});

		await cache.set(
			CACHE_KEY,
			embeds.map(embed => embed.toJSON?.() ?? embed),
			interaction.client.config.get('DATABASE_UPDATE_INTERVAL') * 60_000,
		);
	},

	/**
	 * creates an embed from the LeaderboardData
	 * @param {import('../structures/LunarClient')} client
	 * @param {LeaderboardData} param1
	 */
	createLeaderboardEmbeds(client, { title, description, playerData, playerRequestingEntry, getEntry, isCompetition, lastUpdatedAt }) {
		const { config } = client;
		const ELEMENTS_PER_PAGE = config.get('ELEMENTS_PER_PAGE');
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
					${Formatters.codeBlock('ada', playerList)}
				`)
				.addFields({
					name: playerRequestingEntry
						? 'Your placement'
						: '\u200b',
					value: stripIndent`
						${playerRequestingEntry ?? ''}
						Page: ${page} / ${PAGES_TOTAL}
					`,
				})
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
	createGainedLeaderboardData(client, { hypixelGuild, user, offset, xpType }) {
		const { config } = client;
		const COMPETITION_RUNNING = config.get('COMPETITION_RUNNING');
		const COMPETITION_END_TIME = config.get('COMPETITION_END_TIME');
		const IS_COMPETITION_LB = offset === offsetFlags.COMPETITION_START;
		const SHOULD_USE_COMPETITION_END = !COMPETITION_RUNNING && IS_COMPETITION_LB;
		const CURRENT_OFFSET = SHOULD_USE_COMPETITION_END
			? offsetFlags.COMPETITION_END
			: '';
		/** @type {import('../../structures/database/models/Player')[]} */
		const playerDataRaw = hypixelGuild !== GUILD_ID_ALL
			? hypixelGuild.players.array()
			: client.players.inGuild.array();
		const PLAYER_COUNT = playerDataRaw.length;
		const NUMBER_FORMAT = config.get('NUMBER_FORMAT');
		const LAST_UPDATED_AT = SHOULD_USE_COMPETITION_END
			? COMPETITION_END_TIME
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
				title = 'Slayer XP Gained Leaderboard';
				dataConverter = player => ({
					ign: player.ign,
					discordId: player.discordId,
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

			case 'skill-average': {
				title = 'Skill Average Gained Leaderboard';
				dataConverter = (player) => {
					const { skillAverage, trueAverage } = player.getSkillAverage(CURRENT_OFFSET);
					const { skillAverage: skillAverageOffset, trueAverage: trueAverageOffset } = player.getSkillAverage(offset);
					const skillAverageGain = skillAverage - skillAverageOffset;
					return {
						ign: player.ign,
						discordId: player.discordId,
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
					// use weight from the first time they got alch xp, assume player has not been tracked before
					const { totalWeight: totalWeightOffet } = player.getWeightHistory(player.alchemyXpHistory.findIndex((xp, index) => index >= startIndex && xp !== 0));
					const gainedWeight = totalWeight - totalWeightOffet;
					return {
						ign: player.ign,
						discordId: player.discordId,
						paid: player.paid,
						guildId: player.guildId,
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
						${client.formatDecimalNumber(playerData.reduce((acc, player) => acc + player.gainedWeight, 0) / PLAYER_COUNT)} 
						[${client.formatDecimalNumber(playerData.reduce((acc, player) => acc + player.totalWeight, 0) / PLAYER_COUNT)}]
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
						discordId: player.discordId,
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
					discordId: player.discordId,
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
			const STARTING_TIME = config.get(XP_OFFSETS_TIME[offset]);

			if (IS_COMPETITION_LB) {
				description += `Start: ${timestampToDateMarkdown(STARTING_TIME)}\n`;
				if (COMPETITION_RUNNING) {
					description += `Ends: ${timestampToDateMarkdown(COMPETITION_END_TIME, Formatters.TimestampStyles.RelativeTime)}\n`;
				} else { // competition already ended
					description += `Ended: ${timestampToDateMarkdown(COMPETITION_END_TIME)}\n`;
				}
			} else {
				description += `Tracking xp gained since ${timestampToDateMarkdown(STARTING_TIME)}\n`;
			}

			description += `${hypixelGuild?.name ?? 'Guilds'} total (${PLAYER_COUNT} members): ${totalStats}`;
			title += ` (Current ${upperCaseFirstChar(XP_OFFSETS_CONVERTER[offset])})`;
		} else if (hypixelGuild !== GUILD_ID_ALL) { // purge list
			const { weightReq } = hypixelGuild;

			description += stripIndent`
					Current weight requirement: ${client.formatNumber(hypixelGuild.weightReq)}
					Guild average: ${totalStats}
					Below reqs: ${playerData.filter(({ totalWeight }) => totalWeight < weightReq).length} / ${hypixelGuild.players.size} members
				`;
		} else {
			description += stripIndent`
					Current weight requirements: ${client.hypixelGuilds.cache.map(({ name, weightReq }) => `${name} (${client.formatNumber(weightReq)})`).join(', ')}
					Guilds average: ${totalStats}
					Guilds below reqs: ${playerData.filter(({ totalWeight, guildId }) => totalWeight < client.hypixelGuilds.cache.get(guildId).weightReq).length} / ${client.players.inGuild.size} members
				`;
		}

		// player requesting entry
		const playerRequestingIndex = playerData.findIndex(player => player.discordId === user.id);

		let playerRequestingEntry;

		if (playerRequestingIndex !== -1) {
			const playerRequesting = playerData[playerRequestingIndex];

			playerRequestingEntry = Formatters.codeBlock('ada', stripIndent`
				#${`${playerRequestingIndex + 1}`.padStart(3, '0')} : ${playerRequesting.ign}${IS_COMPETITION_LB && playerRequesting.paid ? ` ${Y_EMOJI_ALT}` : ''}
					 > ${getEntry(playerRequesting)}
			`);
		} else if (xpType !== 'purge') {
			let playerRequesting = user.player;

			// put playerreq into guildplayers and sort then do the above again
			if (playerRequesting) {
				playerRequesting = dataConverter(playerRequesting);
				playerRequestingEntry = Formatters.codeBlock('ada', stripIndent`
					#${`${playerData.findIndex(({ sortingStat }) => sortingStat <= playerRequesting.sortingStat) + 1}`.padStart(3, '0')} : ${playerRequesting.ign}${IS_COMPETITION_LB && playerRequesting.paid ? ` ${Y_EMOJI_ALT}` : ''}
						 > ${getEntry(playerRequesting)}
				`);
			} else {
				playerRequestingEntry = Formatters.codeBlock('ada', stripIndent`
					#??? : unknown ign
						 > link your discord tag on hypixel
				`);
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
	createTotalLeaderboardData(client, { hypixelGuild, user, offset = '', xpType }) {
		const { config } = client;
		/** @type {import('../../structures/database/models/Player')[]} */
		const playerDataRaw = hypixelGuild !== GUILD_ID_ALL
			? hypixelGuild.players.array()
			: client.players.inGuild.array();
		const PLAYER_COUNT = playerDataRaw.length;
		const NUMBER_FORMAT = config.get('NUMBER_FORMAT');
		const LAST_UPDATED_AT = offset
			? config.get(XP_OFFSETS_TIME[offset])
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
					discordId: player.discordId,
					sortingStat: player.getSlayerTotal(offset),
				});
				playerData = playerDataRaw
					.map(dataConverter)
					.sort((a, b) => b.sortingStat - a.sortingStat);
				totalStats = `**${client.formatNumber(playerData.reduce((acc, player) => acc + player.sortingStat, 0) / PLAYER_COUNT, 0, Math.round)}**`;
				getEntry = player => client.formatNumber(player.sortingStat, playerData[0]?.sortingStat.toLocaleString(NUMBER_FORMAT).length);
				break;
			}

			case 'skill-average': {
				title = 'Skill Average Leaderboard';
				dataConverter = (player) => {
					const { skillAverage, trueAverage } = player.getSkillAverage(offset);
					return {
						ign: player.ign,
						discordId: player.discordId,
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
					discordId: player.discordId,
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
						discordId: player.discordId,
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
					discordId: player.discordId,
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
		const playerRequestingIndex = playerData.findIndex(player => player.discordId === user.id);

		let playerRequestingEntry;

		if (playerRequestingIndex !== -1) {
			const playerRequesting = playerData[playerRequestingIndex];

			playerRequestingEntry = Formatters.codeBlock('ada', stripIndent`
				#${`${playerRequestingIndex + 1}`.padStart(3, '0')} : ${playerRequesting.ign}
					 > ${getEntry(playerRequesting)}
			`);
		} else {
			let playerRequesting = user.player;

			// put playerreq into guildplayers and sort then do the above again
			if (playerRequesting) {
				playerRequesting = dataConverter(playerRequesting);
				playerRequestingEntry = Formatters.codeBlock('ada', stripIndent`
					#${`${playerData.findIndex(({ sortingStat }) => sortingStat <= playerRequesting.sortingStat) + 1}`.padStart(3, '0')} : ${playerRequesting.ign}
						 > ${getEntry(playerRequesting)}
				`);
			} else {
				playerRequestingEntry = Formatters.codeBlock('ada', stripIndent`
					#??? : unknown ign
						 > link your discord tag on hypixel
				`);
			}
		}

		if (offset) title += ` (Last ${upperCaseFirstChar(XP_OFFSETS_CONVERTER[offset])})`;

		return {
			title,
			description: `${`${hypixelGuild?.name ?? 'Guilds'} average (${PLAYER_COUNT} members): ${totalStats}`.padEnd(62, '\xa0')}\u200b`,
			playerData,
			playerRequestingEntry,
			getEntry,
			lastUpdatedAt: LAST_UPDATED_AT,
		};
	},

};
