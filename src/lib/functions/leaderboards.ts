import {
	ActionRowBuilder,
	bold,
	ButtonStyle,
	codeBlock,
	EmbedBuilder,
	SelectMenuBuilder,
	SelectMenuOptionBuilder,
	time,
	TimestampStyles,
} from 'discord.js';
import { stripIndent, oneLine } from 'common-tags';
import { InteractionUtil, UserUtil } from '#utils';
import { redis } from '#api';
import {
	GUILD_ID_ALL,
	LEADERBOARD_XP_TYPES,
	Offset,
	RedisKey,
	UnicodeEmoji,
	XP_OFFSETS_CONVERTER,
	XP_OFFSETS_SHORT,
	XP_OFFSETS_TIME,
} from '#constants';
import {
	assertNever,
	buildPaginationActionRow,
	days,
	formatDecimalNumber,
	formatNumber,
	minutes,
	seconds,
	upperCaseFirstChar,
} from '.';
import type { ArrayElementType } from '@sapphire/utilities';
import type {
	APIEmbed,
	ButtonInteraction,
	JSONEncodable,
	Message,
	MessageActionRowComponentBuilder,
	SelectMenuInteraction,
	Snowflake,
	User,
} from 'discord.js';
import type { Player } from '#structures/database/models/Player';
import type { HypixelGuild } from '#structures/database/models/HypixelGuild';
import type { LunarClient } from '#structures/LunarClient';
import type { ConfigManager } from '#structures/database/managers/ConfigManager';
import type { RepliableInteraction } from '#utils';
import type { COSMETIC_SKILLS, DUNGEON_TYPES_AND_CLASSES, DungeonTypes, SKILLS, SkillTypes, SLAYERS } from '#constants';

export type LeaderboardXPTypes =
	| 'lily-weight'
	| 'senither-weight'
	| 'skill-average'
	| ArrayElementType<typeof SKILLS>
	| ArrayElementType<typeof COSMETIC_SKILLS>
	| 'slayer'
	| ArrayElementType<typeof SLAYERS>
	| ArrayElementType<typeof DUNGEON_TYPES_AND_CLASSES>
	| 'guild';

type GetEntry = (player: PlayerData) => string;

interface PlayerData {
	ign: string;
	discordId: Snowflake | null;
	xpLastUpdatedAt: Date | null;
	sortingStat: number;

	/** gained */
	/** purge */
	isStaff?: boolean;
	guildId?: string | null;
	gainedWeight?: number;
	totalWeight?: number;
	gainedGuildXp?: number;
	/** non-purge */
	paid?: boolean;
	/** skill-average */
	skillAverageGain?: number;
	trueAverageGain?: number;
	/** weight */
	weightGain?: number;
	overflowGain?: number;
	totalWeightGain?: number;

	/** total */
	/** skill-average */
	skillAverage?: number;
	trueAverage?: number;
	/** weight */
	weight?: number;
	overflow?: number;
	// totalWeight?: number;
	/** default */
	xp?: number;
	progressLevel?: number;
}

type DataConverter = (player: Player) => PlayerData;

type LeaderboardType = 'gained' | 'total';

export type LeaderboardXPOffsets = typeof XP_OFFSETS_SHORT[keyof typeof XP_OFFSETS_SHORT] | '';

interface LeaderboardArgs {
	lbType: LeaderboardType;
	xpType: LeaderboardXPTypes | 'purge';
	offset: LeaderboardXPOffsets;
	hypixelGuild: HypixelGuild | typeof GUILD_ID_ALL;
	user: User;
}

interface LeaderboardArgsWithPage extends LeaderboardArgs {
	page: number;
}

type CacheKeyParsed = [
	Snowflake, // user id
	string, // hypixel guild id
	LeaderboardType, // lbType
	LeaderboardXPTypes | 'purge', // xpType
	LeaderboardXPOffsets, // offset
];

type ButtonCustomIdParsed = [
	...CacheKeyParsed,
	number, // new page
	UnicodeEmoji.DoubleLeft | UnicodeEmoji.Left | UnicodeEmoji.Right | UnicodeEmoji.DoubleRight | UnicodeEmoji.Reload, // emoji
];

type SelectMenuCustomIdParsed = [
	...CacheKeyParsed,
	Exclude<keyof LeaderboardArgs, 'hypixelGuild' | 'user'> | 'guild', // selectType
];

type CacheKey = ReturnType<typeof createCacheKey>;

/**
 * returns the key for the redis cache
 * @param leaderboardArgs
 */
const createCacheKey = ({ user: { id: USER_ID }, hypixelGuild, lbType, xpType, offset }: LeaderboardArgs) =>
	`${RedisKey.Leaderboard}:${USER_ID}:${
		typeof hypixelGuild === 'string' ? hypixelGuild : hypixelGuild.guildId
	}:${lbType}:${xpType}:${offset}` as const;

/**
 * default xp offset based on whether there is a current competition or not
 * @param config
 */
export const getDefaultOffset = (config: ConfigManager) =>
	config.get('COMPETITION_RUNNING') ||
	(Date.now() >= config.get(XP_OFFSETS_TIME[Offset.CompetitionEnd]) &&
		Date.now() - config.get(XP_OFFSETS_TIME[Offset.CompetitionEnd]) <= days(1))
		? Offset.CompetitionStart
		: config.get('DEFAULT_XP_OFFSET');

/**
 * returns a message action row with pagination buttons
 * @param client
 * @param cacheKey
 * @param leaderboardArgs
 * @param totalPages
 * @param isExpired
 */
function createActionRows(
	client: LunarClient,
	cacheKey: CacheKey,
	{ page, lbType, xpType, offset, hypixelGuild }: LeaderboardArgsWithPage,
	totalPages: number,
	isExpired = false,
) {
	const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
	const guildSelectMenu = new SelectMenuBuilder()
		.setCustomId(`${cacheKey}:guild`)
		.setPlaceholder(hypixelGuild !== GUILD_ID_ALL ? `Guild: ${hypixelGuild}` : 'Guilds: All')
		.addOptions(
			...client.hypixelGuilds.cache.map(({ guildId, name }) =>
				new SelectMenuOptionBuilder() //
					.setLabel(name)
					.setValue(guildId),
			),
			new SelectMenuOptionBuilder() //
				.setLabel('ALL')
				.setValue(GUILD_ID_ALL),
		);

	if (xpType !== 'purge') {
		const offsetSelectMenu = new SelectMenuBuilder()
			.setCustomId(`${cacheKey}:offset`)
			.setPlaceholder(
				`Offset: ${upperCaseFirstChar(XP_OFFSETS_CONVERTER[offset as keyof typeof XP_OFFSETS_CONVERTER] ?? 'None')}`,
			)
			.addOptions(
				Object.keys(XP_OFFSETS_SHORT).map((_offset) =>
					new SelectMenuOptionBuilder()
						.setLabel(upperCaseFirstChar(_offset))
						.setValue(XP_OFFSETS_CONVERTER[_offset as keyof typeof XP_OFFSETS_CONVERTER]),
				),
			);

		if (lbType === 'total') {
			offsetSelectMenu.addOptions(
				new SelectMenuOptionBuilder() //
					.setLabel('None')
					.setValue('none'),
			);
		}

		rows.push(
			new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
				new SelectMenuBuilder()
					.setCustomId(`${cacheKey}:lbType`)
					.setPlaceholder(`Lb Type: ${upperCaseFirstChar(lbType)}`)
					.addOptions(
						new SelectMenuOptionBuilder() //
							.setLabel('Total XP')
							.setValue('total'),
						new SelectMenuOptionBuilder() //
							.setLabel('Gained XP')
							.setValue('gained'),
					),
			),
			new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
				new SelectMenuBuilder()
					.setCustomId(`${cacheKey}:xpType`)
					.setPlaceholder(
						`XP Type: ${xpType
							.split('-')
							.map((x) => upperCaseFirstChar(x))
							.join(' ')}`,
					)
					.addOptions(
						LEADERBOARD_XP_TYPES.map((type) =>
							new SelectMenuOptionBuilder() //
								.setLabel(upperCaseFirstChar(type.replaceAll('-', ' ')))
								.setValue(type),
						),
					),
			),
			new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(offsetSelectMenu),
		);
	}

	rows.push(
		new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(guildSelectMenu),
		buildPaginationActionRow(cacheKey, page, totalPages, {
			disablePages: isExpired,
			pageStyle: isExpired ? ButtonStyle.Secondary : ButtonStyle.Primary,
			reloadStyle: isExpired ? ButtonStyle.Danger : ButtonStyle.Primary,
		}),
	);

	return rows;
}

/**
 * handles a leaderbaord message
 * @param interaction
 * @param leaderboardArgs
 */
export async function handleLeaderboardCommandInteraction(
	interaction: RepliableInteraction,
	leaderboardArgs: LeaderboardArgsWithPage,
) {
	return InteractionUtil.reply(interaction, await getLeaderboardMessageOptions(interaction.client, leaderboardArgs));
}

/**
 * handles a leaderbaord message
 * @param interaction
 * @param args parsed customId, split by ':'
 */
export async function handleLeaderboardButtonInteraction(interaction: ButtonInteraction<'cachedOrDM'>, args: string[]) {
	const [USER_ID, HYPIXEL_GUILD_ID, LB_TYPE, XP_TYPE, OFFSET, PAGE, EMOJI] = args as ButtonCustomIdParsed;
	const leaderboardArgs: LeaderboardArgsWithPage = {
		lbType: LB_TYPE,
		xpType: XP_TYPE,
		offset: OFFSET,
		hypixelGuild:
			HYPIXEL_GUILD_ID !== GUILD_ID_ALL
				? interaction.client.hypixelGuilds.cache.get(HYPIXEL_GUILD_ID)!
				: HYPIXEL_GUILD_ID,
		user: interaction.user,
		page: Number(PAGE),
	};

	if (USER_ID !== interaction.user.id) {
		return handleLeaderboardCommandInteraction(interaction, leaderboardArgs);
	}

	const { embeds, components } = await getLeaderboardMessageOptions(
		interaction.client,
		leaderboardArgs,
		EMOJI === UnicodeEmoji.Reload,
	);

	if (!embeds.length) {
		await InteractionUtil.update(interaction, {
			components,
		});

		return InteractionUtil.reply(interaction, {
			content: `leaderboard timed out, use ${`[${UnicodeEmoji.Reload}](${
				(interaction.message as Message).url
			})`} to refresh the data`,
			ephemeral: true,
		});
	}

	return InteractionUtil.update(interaction, {
		embeds,
		components,
	});
}

/**
 * handles a leaderbaord message
 * @param interaction
 * @param args parsed customId, split by ':'
 */
export async function handleLeaderboardSelectMenuInteraction(
	interaction: SelectMenuInteraction<'cachedOrDM'>,
	args: string[],
) {
	const [USER_ID, HYPIXEL_GUILD_ID, LB_TYPE, XP_TYPE, OFFSET, SELECT_TYPE] = args as SelectMenuCustomIdParsed;
	const leaderboardArgs: LeaderboardArgsWithPage = {
		lbType: LB_TYPE,
		xpType: XP_TYPE,
		offset: OFFSET,
		hypixelGuild:
			HYPIXEL_GUILD_ID !== GUILD_ID_ALL
				? interaction.client.hypixelGuilds.cache.get(HYPIXEL_GUILD_ID)!
				: HYPIXEL_GUILD_ID,
		user: interaction.user,
		page: 1,
	};

	switch (SELECT_TYPE) {
		case 'lbType':
			[leaderboardArgs.lbType] = interaction.values as [LeaderboardType];

			// reset offsets to defaults
			switch (leaderboardArgs.lbType) {
				case 'gained':
					leaderboardArgs.offset = getDefaultOffset(interaction.client.config);
					break;

				case 'total':
					leaderboardArgs.offset = '';
					break;
			}
			break;

		case 'offset': {
			const [OFFSET_SELECT] = interaction.values;
			leaderboardArgs.offset = OFFSET_SELECT !== 'none' ? (OFFSET_SELECT as LeaderboardXPOffsets) : '';
			break;
		}

		case 'guild': {
			const [HYPIXEL_GUILD_ID_SELECT] = interaction.values as [string];
			leaderboardArgs.hypixelGuild =
				HYPIXEL_GUILD_ID_SELECT !== GUILD_ID_ALL
					? interaction.client.hypixelGuilds.cache.get(HYPIXEL_GUILD_ID_SELECT)!
					: GUILD_ID_ALL;
			break;
		}

		case 'xpType':
			[leaderboardArgs[SELECT_TYPE]] = interaction.values as [LeaderboardXPTypes];
			break;

		default:
			return assertNever(SELECT_TYPE);
	}

	if (USER_ID !== interaction.user.id) {
		return handleLeaderboardCommandInteraction(interaction, leaderboardArgs);
	}

	return InteractionUtil.update(interaction, await getLeaderboardMessageOptions(interaction.client, leaderboardArgs));
}

/**
 * creates an embed from the LeaderboardData
 * @param client
 * @param leaderboardArgs
 * @param isReloadButton
 */
async function getLeaderboardMessageOptions(
	client: LunarClient,
	leaderboardArgs: LeaderboardArgsWithPage,
	isReloadButton: boolean | null = null,
) {
	const CACHE_KEY = createCacheKey(leaderboardArgs);

	if (!isReloadButton) {
		const cachedEmbeds: APIEmbed[] | null = JSON.parse((await redis.get(CACHE_KEY))!);

		if (cachedEmbeds) {
			return {
				embeds: [cachedEmbeds[leaderboardArgs.page - 1]!],
				components: createActionRows(client, CACHE_KEY, leaderboardArgs, cachedEmbeds.length),
			};
		}

		if (isReloadButton === false) {
			return {
				embeds: [],
				components: createActionRows(client, CACHE_KEY, leaderboardArgs, Number.POSITIVE_INFINITY, true),
			};
		}
	}

	const { title, description, playerData, playerRequestingEntry, getEntry, isCompetition, lastUpdatedAt } =
		getLeaderboardDataCreator(leaderboardArgs.lbType)(client, leaderboardArgs);
	const { config } = client;
	const ELEMENTS_PER_PAGE = config.get('ELEMENTS_PER_PAGE');
	const PLAYER_COUNT = playerData.length;
	const PAGES_TOTAL = PLAYER_COUNT ? Math.ceil(PLAYER_COUNT / ELEMENTS_PER_PAGE) : 1; // to create at least one page if player list is empty
	const embeds: JSONEncodable<APIEmbed>[] = [];

	for (let page = 1; page <= PAGES_TOTAL; ++page) {
		let playerList = '';

		// get the page elements
		for (let index = Math.max(0, page - 1) * ELEMENTS_PER_PAGE; index < page * ELEMENTS_PER_PAGE; ++index) {
			if (index < PLAYER_COUNT) {
				const player = playerData[index]!;
				playerList += `\n${stripIndent`
					#${`${index + 1}`.padStart(3, '0')} : ${player.ign}${isCompetition && player.paid ? ` ${UnicodeEmoji.VarY}` : ''}${
					player.isStaff ? ' [STAFF]' : ''
				}
						 > ${getEntry(player)}`}`; // needs to be in one line or entries are separated by a newline
			} else {
				playerList += '\n\u200B\n\u200B';
			}
		}

		embeds.push(
			new EmbedBuilder()
				.setColor(config.get('EMBED_BLUE'))
				.setTitle(title)
				.setDescription(
					stripIndent`
						${description}
						${codeBlock('ada', playerList)}
					`,
				)
				.addFields({
					name: playerRequestingEntry ? 'Your placement' : '\u200B',
					value: stripIndent`
						${playerRequestingEntry ?? ''}
						Page: ${page} / ${PAGES_TOTAL}
					`,
				})
				.setFooter({ text: 'Updated at' })
				.setTimestamp(lastUpdatedAt),
		);
	}

	void redis.psetex(CACHE_KEY, client.config.get('DATABASE_UPDATE_INTERVAL') * minutes(1), JSON.stringify(embeds));

	if (leaderboardArgs.page < 1) {
		leaderboardArgs.page = 1;
	} else if (leaderboardArgs.page > embeds.length) {
		leaderboardArgs.page = embeds.length;
	}

	return {
		embeds: [embeds[leaderboardArgs.page - 1]!],
		components: createActionRows(client, CACHE_KEY, leaderboardArgs, embeds.length),
	};
}

/**
 * returns the create[type]LeaderboardData function
 * @param lbType
 */
function getLeaderboardDataCreator(lbType: string) {
	switch (lbType) {
		case 'gained':
			return createGainedLeaderboardData;

		case 'total':
			return createTotalLeaderboardData;

		default:
			throw `unsupported leaderboard type ${lbType}`;
	}
}

/**
 * @param client
 * @param hypixelGuild
 * @param dataConverter
 */
const getPlayerData = (
	client: LunarClient,
	hypixelGuild: HypixelGuild | typeof GUILD_ID_ALL,
	dataConverter: DataConverter,
) =>
	(hypixelGuild !== GUILD_ID_ALL ? hypixelGuild.players : client.players.inGuild)
		.map((player) => dataConverter(player))
		.sort(({ sortingStat: a }, { sortingStat: b }) => b - a);

/**
 * create gained leaderboard data
 * @param client
 * @param args
 */
function createGainedLeaderboardData(client: LunarClient, { hypixelGuild, user, offset, xpType }: LeaderboardArgs) {
	const { config } = client;
	const COMPETITION_RUNNING = config.get('COMPETITION_RUNNING');
	const COMPETITION_END_TIME = config.get(XP_OFFSETS_TIME[Offset.CompetitionEnd]);
	const IS_COMPETITION_LB = offset === Offset.CompetitionStart;
	const SHOULD_USE_COMPETITION_END = !COMPETITION_RUNNING && IS_COMPETITION_LB;
	const CURRENT_OFFSET = SHOULD_USE_COMPETITION_END ? Offset.CompetitionEnd : '';

	let playerData: PlayerData[];
	let totalStats: string;
	let dataConverter: DataConverter;
	let getEntry: GetEntry;
	let title: string;

	// type specific stuff
	switch (xpType) {
		case 'slayer': {
			title = 'Slayer XP Gained Leaderboard';
			dataConverter = (player) => ({
				ign: player.ign,
				discordId: player.discordId,
				xpLastUpdatedAt: player.xpLastUpdatedAt,
				paid: player.paid,
				sortingStat: player.getSlayerTotal(CURRENT_OFFSET) - player.getSlayerTotal(offset),
			});
			playerData = getPlayerData(client, hypixelGuild, dataConverter);
			totalStats = bold(formatNumber(Math.round(playerData.reduce((acc, player) => acc + player.sortingStat, 0))));
			getEntry = (player) =>
				formatNumber(player.sortingStat, { padding: playerData[0]?.sortingStat.toLocaleString('fr-FR').length });
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
					xpLastUpdatedAt: player.xpLastUpdatedAt,
					paid: player.paid,
					skillAverageGain,
					trueAverageGain: trueAverage - trueAverageOffset,
					sortingStat: skillAverageGain,
				};
			};
			playerData = getPlayerData(client, hypixelGuild, dataConverter);
			totalStats = oneLine`
				${bold((playerData.reduce((acc, player) => acc + player.skillAverageGain!, 0) / playerData.length).toFixed(2))}
				[${bold((playerData.reduce((acc, player) => acc + player.trueAverageGain!, 0) / playerData.length).toFixed(2))}]
			`;
			getEntry = (player: PlayerData) =>
				`${formatDecimalNumber(player.skillAverageGain!, {
					padding: Math.trunc(playerData[0]?.skillAverageGain!).toLocaleString('fr-FR').length,
				})} [${formatDecimalNumber(player.trueAverageGain!, {
					padding: Math.trunc(Math.max(...playerData.map(({ trueAverageGain }) => trueAverageGain!))).toLocaleString(
						'fr-FR',
					).length,
				})}]`;
			break;
		}

		case 'purge': {
			title = `${hypixelGuild || ''} Purge List (${config.get('PURGE_LIST_OFFSET')} days interval)`;
			dataConverter = (player) => {
				const { totalWeight } = player.getLilyWeight();
				const startIndex = player.alchemyXpHistory.length - 1 - config.get('PURGE_LIST_OFFSET');
				// use weight from the first time they got alch xp, assume player has not been tracked before
				const XP_TRACKING_START = player.alchemyXpHistory.findIndex((xp, index) => index >= startIndex && xp !== 0);
				const { totalWeight: totalWeightOffet } = player.getLilyWeightHistory(XP_TRACKING_START);
				const gainedWeight = totalWeight - totalWeightOffet;
				const gainedGuildXp = player.guildXp - (player.guildXpHistory[XP_TRACKING_START] ?? 0);
				return {
					ign: player.ign,
					discordId: player.discordId,
					xpLastUpdatedAt: player.xpLastUpdatedAt,
					isStaff: player.isStaff,
					guildId: player.guildId,
					gainedWeight,
					totalWeight,
					gainedGuildXp,
					sortingStat:
						totalWeight *
						(1 + (gainedWeight >= 0 ? Math.sqrt(gainedWeight) / 20 : -0.25)) *
						(gainedGuildXp > 1 ? gainedGuildXp ** (1 / 10) : 1),
					// sortingStat: totalWeight * (gainedWeight >= 50 ? ((gainedWeight / 50) ** (1 / 1.5)) : gainedGuildXp > 0 ? 0.9 : 0.75) * (gainedGuildXp > 5_000 ? (gainedGuildXp / 5_000) ** (1 / 10) : 0.9),
					// sortingStat: totalWeight * (gainedWeight > 0 ? 1 + (gainedWeight / totalWeight) : 0.75) * (gainedGuildXp > 5_000 ? (gainedGuildXp / 5_000) ** (1 / 10) : 0.9),
				};
			};
			playerData = getPlayerData(client, hypixelGuild, dataConverter)
				.sort(({ totalWeight: a }, { totalWeight: b }) => a! - b!)
				.sort(({ sortingStat: a }, { sortingStat: b }) => a - b);
			const temp1 = Math.trunc(playerData.at(-1)!.sortingStat).toLocaleString('fr-FR').length;
			const temp2 = Math.trunc(Math.max(...playerData.map(({ gainedGuildXp }) => gainedGuildXp!))).toLocaleString(
				'fr-FR',
			).length;
			const PADDING_AMOUNT_GAIN = Math.trunc(
				Math.max(...playerData.map(({ gainedWeight }) => gainedWeight!)),
			).toLocaleString('fr-FR').length;
			const PADDING_AMOUNT_TOTAL = Math.trunc(
				Math.max(...playerData.map(({ totalWeight }) => totalWeight!)),
			).toLocaleString('fr-FR').length;
			getEntry = (player) =>
				`${formatDecimalNumber(player.sortingStat, { padding: temp1 })} - ${formatDecimalNumber(player.gainedWeight!, {
					padding: PADDING_AMOUNT_GAIN,
				})} [${formatDecimalNumber(player.totalWeight!, { padding: PADDING_AMOUNT_TOTAL })}] - ${formatNumber(
					player.gainedGuildXp!,
					{ padding: temp2 },
				)}`;
			totalStats = oneLine`
				${formatDecimalNumber(playerData.reduce((acc, player) => acc + player.gainedWeight!, 0) / playerData.length)} 
				[${formatDecimalNumber(playerData.reduce((acc, player) => acc + player.totalWeight!, 0) / playerData.length)}]
			`;
			break;
		}

		case 'lily-weight': {
			title = 'Lily Weight Gained Leaderboard';
			dataConverter = (player) => {
				const { weight, overflow, totalWeight } = player.getLilyWeight(CURRENT_OFFSET);
				const {
					weight: weightOffset,
					overflow: overflowOffset,
					totalWeight: totalWeightOffet,
				} = player.getLilyWeight(offset);
				const totalWeightGain = totalWeight - totalWeightOffet;
				return {
					ign: player.ign,
					discordId: player.discordId,
					xpLastUpdatedAt: player.xpLastUpdatedAt,
					paid: player.paid,
					weightGain: weight - weightOffset,
					overflowGain: overflow - overflowOffset,
					totalWeightGain,
					sortingStat: totalWeightGain,
				};
			};
			playerData = getPlayerData(client, hypixelGuild, dataConverter);
			totalStats = oneLine`
				${bold(formatDecimalNumber(playerData.reduce((acc, player) => acc + player.totalWeightGain!, 0) / playerData.length))}
				[${bold(formatDecimalNumber(playerData.reduce((acc, player) => acc + player.weightGain!, 0) / playerData.length))}
				+ ${bold(formatDecimalNumber(playerData.reduce((acc, player) => acc + player.overflowGain!, 0) / playerData.length))}]
			`;
			getEntry = (player) =>
				`${formatDecimalNumber(player.totalWeightGain!, {
					padding: Math.trunc(playerData[0]?.totalWeightGain!).toLocaleString('fr-FR').length,
				})} [${formatDecimalNumber(player.weightGain!, {
					padding: Math.trunc(Math.max(...playerData.map(({ weightGain }) => weightGain!))).toLocaleString('fr-FR')
						.length,
				})} + ${formatDecimalNumber(player.overflowGain!, {
					padding: Math.trunc(Math.max(...playerData.map(({ overflowGain }) => overflowGain!))).toLocaleString('fr-FR')
						.length,
				})}]`;
			break;
		}

		case 'senither-weight': {
			title = 'Senither Weight Gained Leaderboard';
			dataConverter = (player) => {
				const { weight, overflow, totalWeight } = player.getSenitherWeight(CURRENT_OFFSET);
				const {
					weight: weightOffset,
					overflow: overflowOffset,
					totalWeight: totalWeightOffet,
				} = player.getSenitherWeight(offset);
				const totalWeightGain = totalWeight - totalWeightOffet;
				return {
					ign: player.ign,
					discordId: player.discordId,
					xpLastUpdatedAt: player.xpLastUpdatedAt,
					paid: player.paid,
					weightGain: weight - weightOffset,
					overflowGain: overflow - overflowOffset,
					totalWeightGain,
					sortingStat: totalWeightGain,
				};
			};
			playerData = getPlayerData(client, hypixelGuild, dataConverter);
			totalStats = oneLine`
				${bold(formatDecimalNumber(playerData.reduce((acc, player) => acc + player.totalWeightGain!, 0) / playerData.length))}
				[${bold(formatDecimalNumber(playerData.reduce((acc, player) => acc + player.weightGain!, 0) / playerData.length))}
				+ ${bold(formatDecimalNumber(playerData.reduce((acc, player) => acc + player.overflowGain!, 0) / playerData.length))}]
			`;
			getEntry = (player) =>
				`${formatDecimalNumber(player.totalWeightGain!, {
					padding: Math.trunc(playerData[0]?.totalWeightGain!).toLocaleString('fr-FR').length,
				})} [${formatDecimalNumber(player.weightGain!, {
					padding: Math.trunc(Math.max(...playerData.map(({ weightGain }) => weightGain!))).toLocaleString('fr-FR')
						.length,
				})} + ${formatDecimalNumber(player.overflowGain!, {
					padding: Math.trunc(Math.max(...playerData.map(({ overflowGain }) => overflowGain!))).toLocaleString('fr-FR')
						.length,
				})}]`;
			break;
		}

		default: {
			title = `${upperCaseFirstChar(xpType)} XP Gained Leaderboard`;
			const XP_ARGUMENT = `${xpType}Xp${CURRENT_OFFSET}` as const;
			const OFFSET_ARGUMENT = `${xpType}Xp${offset}` as const;
			dataConverter = (player) => ({
				ign: player.ign,
				discordId: player.discordId,
				xpLastUpdatedAt: player.xpLastUpdatedAt,
				paid: player.paid,
				sortingStat: player[XP_ARGUMENT] - player[OFFSET_ARGUMENT],
			});
			playerData = getPlayerData(client, hypixelGuild, dataConverter);
			totalStats = bold(formatNumber(Math.round(playerData.reduce((acc, player) => acc + player.sortingStat, 0))));
			getEntry = (player) =>
				formatNumber(Math.round(player.sortingStat), {
					padding: Math.round(playerData[0]?.sortingStat!).toLocaleString('fr-FR').length,
				});
		}
	}

	// description
	let description = '';

	if (xpType !== 'purge') {
		if (IS_COMPETITION_LB) {
			description += `Start: ${time(seconds.fromMilliseconds(config.get(XP_OFFSETS_TIME[offset])))}\n`;
			description += COMPETITION_RUNNING
				? `Ends: ${time(seconds.fromMilliseconds(COMPETITION_END_TIME), TimestampStyles.RelativeTime)}\n`
				: `Ended: ${time(seconds.fromMilliseconds(COMPETITION_END_TIME))}\n`;
		} else {
			description += `Tracking xp gained since ${time(
				seconds.fromMilliseconds(config.get(XP_OFFSETS_TIME[offset as keyof typeof XP_OFFSETS_TIME])),
			)}\n`;
		}

		description += `${typeof hypixelGuild === 'string' ? 'Guilds' : hypixelGuild} total (${
			playerData.length
		} members): ${totalStats}`;
		title += ` (Current ${upperCaseFirstChar(XP_OFFSETS_CONVERTER[offset as keyof typeof XP_OFFSETS_CONVERTER])})`;
	} else if (hypixelGuild !== GUILD_ID_ALL) {
		// purge list
		const { weightReq } = hypixelGuild;

		description += stripIndent`
			Current weight requirement: ${formatNumber(weightReq!)}
			Guild average: ${totalStats}
			Below reqs: ${playerData.filter(({ totalWeight }) => totalWeight! < weightReq!).length} / ${
			hypixelGuild.players.size
		} members

			"activity weight" - gained [total] weight - guild xp
		`;
	} else {
		description += stripIndent`
			Current weight requirements: ${client.hypixelGuilds.cache
				.map(({ name, weightReq }) => `${name} (${formatNumber(weightReq!)})`)
				.join(', ')}
			Guilds average: ${totalStats}
			Guilds below reqs: ${
				playerData.filter(
					({ totalWeight, guildId }) => totalWeight! < client.hypixelGuilds.cache.get(guildId!)?.weightReq!,
				).length
			} / ${client.players.inGuild.size} members
		`;
	}

	// player requesting entry
	const playerRequestingIndex = playerData.findIndex((player) => player.discordId === user.id);

	let playerRequestingEntry: string | undefined;

	if (playerRequestingIndex !== -1) {
		const playerRequesting = playerData[playerRequestingIndex]!;

		playerRequestingEntry = codeBlock(
			'ada',
			stripIndent`
				#${`${playerRequestingIndex + 1}`.padStart(3, '0')} : ${playerRequesting.ign}${
				IS_COMPETITION_LB && playerRequesting.paid ? ` ${UnicodeEmoji.VarY}` : ''
			}
					 > ${getEntry(playerRequesting)}
			`,
		);
	} else if (xpType !== 'purge') {
		const playerRequesting = UserUtil.getPlayer(user);

		// put playerreq into guildplayers and sort then do the above again
		if (playerRequesting) {
			const playerRequestingConverted = dataConverter(playerRequesting);
			playerRequestingEntry = codeBlock(
				'ada',
				stripIndent`
					#${`${playerData.findIndex(({ sortingStat }) => sortingStat <= playerRequestingConverted.sortingStat) + 1}`.padStart(
						3,
						'0',
					)} : ${playerRequestingConverted.ign}${
					IS_COMPETITION_LB && playerRequesting.paid ? ` ${UnicodeEmoji.VarY}` : ''
				}
						 > ${getEntry(playerRequestingConverted)}
				`,
			);
		} else {
			playerRequestingEntry = codeBlock(
				'ada',
				stripIndent`
					#??? : unknown ign
						 > link your discord tag on hypixel
				`,
			);
		}
	}

	return {
		title,
		description,
		playerData,
		playerRequestingEntry,
		getEntry,
		isCompetition: IS_COMPETITION_LB,
		lastUpdatedAt: SHOULD_USE_COMPETITION_END
			? COMPETITION_END_TIME
			: Math.min(...playerData.map(({ xpLastUpdatedAt }) => xpLastUpdatedAt?.getTime() ?? Number.POSITIVE_INFINITY)),
	};
}

/**
 * create total leaderboard data
 * @param client
 * @param args
 */
function createTotalLeaderboardData(client: LunarClient, { hypixelGuild, user, offset = '', xpType }: LeaderboardArgs) {
	const { config } = client;

	let playerData: PlayerData[];
	let totalStats: string;
	let dataConverter: DataConverter;
	let getEntry: GetEntry;
	let title: string;

	// type specific stuff
	switch (xpType) {
		case 'slayer': {
			title = 'Slayer XP Leaderboard';
			dataConverter = (player) => ({
				ign: player.ign,
				discordId: player.discordId,
				xpLastUpdatedAt: player.xpLastUpdatedAt,
				sortingStat: player.getSlayerTotal(offset),
			});
			playerData = getPlayerData(client, hypixelGuild, dataConverter);
			totalStats = bold(
				formatNumber(Math.round(playerData.reduce((acc, player) => acc + player.sortingStat, 0) / playerData.length)),
			);
			getEntry = (player) =>
				formatNumber(player.sortingStat, { padding: playerData[0]?.sortingStat.toLocaleString('fr-FR').length });
			break;
		}

		case 'skill-average': {
			title = 'Skill Average Leaderboard';
			dataConverter = (player) => {
				const { skillAverage, trueAverage } = player.getSkillAverage(offset);
				return {
					ign: player.ign,
					discordId: player.discordId,
					xpLastUpdatedAt: player.xpLastUpdatedAt,
					skillAverage,
					trueAverage,
					sortingStat: skillAverage,
				};
			};
			playerData = getPlayerData(client, hypixelGuild, dataConverter);
			totalStats = oneLine`
				${bold(
					formatDecimalNumber(playerData.reduce((acc, player) => acc + player.skillAverage!, 0) / playerData.length, {
						padding: 2,
					}),
				)}
				[${bold(
					formatDecimalNumber(playerData.reduce((acc, player) => acc + player.trueAverage!, 0) / playerData.length, {
						padding: 2,
					}),
				)}]
			`;
			getEntry = (player) =>
				`${formatDecimalNumber(player.skillAverage!, { padding: 2 })} [${formatDecimalNumber(player.trueAverage!, {
					padding: 2,
				})}]`;
			break;
		}

		case 'zombie':
		case 'spider':
		case 'wolf':
		case 'enderman':
		case 'blaze':
		case 'guild': {
			title = `${upperCaseFirstChar(xpType)} XP Leaderboard`;
			const XP_ARGUMENT = `${xpType}Xp${offset}` as const;
			dataConverter = (player) => ({
				ign: player.ign,
				discordId: player.discordId,
				xpLastUpdatedAt: player.xpLastUpdatedAt,
				sortingStat: player[XP_ARGUMENT],
			});
			playerData = getPlayerData(client, hypixelGuild, dataConverter);
			totalStats = bold(
				formatNumber(Math.round(playerData.reduce((acc, player) => acc + player.sortingStat, 0) / playerData.length)),
			);
			getEntry = (player) =>
				formatNumber(player.sortingStat, { padding: playerData[0]?.sortingStat.toLocaleString('fr-FR').length });
			break;
		}

		case 'lily-weight': {
			title = 'Lily Weight Leaderboard';
			dataConverter = (player) => {
				const { weight, overflow, totalWeight } = player.getLilyWeight(offset);
				return {
					ign: player.ign,
					discordId: player.discordId,
					xpLastUpdatedAt: player.xpLastUpdatedAt,
					weight,
					overflow,
					totalWeight,
					sortingStat: totalWeight,
				};
			};
			playerData = getPlayerData(client, hypixelGuild, dataConverter);
			totalStats = oneLine`
				${bold(formatDecimalNumber(playerData.reduce((acc, player) => acc + player.totalWeight!, 0) / playerData.length))}
				[${bold(formatDecimalNumber(playerData.reduce((acc, player) => acc + player.weight!, 0) / playerData.length))}
				+ ${bold(formatDecimalNumber(playerData.reduce((acc, player) => acc + player.overflow!, 0) / playerData.length))}]
			`;
			getEntry = (player) =>
				`${formatDecimalNumber(player.totalWeight!, {
					padding: Math.trunc(playerData[0]?.totalWeight!).toLocaleString('fr-FR').length,
				})} [${formatDecimalNumber(player.weight!, {
					padding: Math.trunc(Math.max(...playerData.map(({ weight }) => weight!))).toLocaleString('fr-FR').length,
				})} + ${formatDecimalNumber(player.overflow!, {
					padding: Math.trunc(Math.max(...playerData.map(({ overflow }) => overflow!))).toLocaleString('fr-FR').length,
				})}]`;
			break;
		}

		case 'senither-weight': {
			title = 'Senither Weight Leaderboard';
			dataConverter = (player) => {
				const { weight, overflow, totalWeight } = player.getSenitherWeight(offset);
				return {
					ign: player.ign,
					discordId: player.discordId,
					xpLastUpdatedAt: player.xpLastUpdatedAt,
					weight,
					overflow,
					totalWeight,
					sortingStat: totalWeight,
				};
			};
			playerData = getPlayerData(client, hypixelGuild, dataConverter);
			totalStats = oneLine`
				${bold(formatDecimalNumber(playerData.reduce((acc, player) => acc + player.totalWeight!, 0) / playerData.length))}
				[${bold(formatDecimalNumber(playerData.reduce((acc, player) => acc + player.weight!, 0) / playerData.length))}
				+ ${bold(formatDecimalNumber(playerData.reduce((acc, player) => acc + player.overflow!, 0) / playerData.length))}]
			`;
			getEntry = (player) =>
				`${formatDecimalNumber(player.totalWeight!, {
					padding: Math.trunc(playerData[0]?.totalWeight!).toLocaleString('fr-FR').length,
				})} [${formatDecimalNumber(player.weight!, {
					padding: Math.trunc(Math.max(...playerData.map(({ weight }) => weight!))).toLocaleString('fr-FR').length,
				})} + ${formatDecimalNumber(player.overflow!, {
					padding: Math.trunc(Math.max(...playerData.map(({ overflow }) => overflow!))).toLocaleString('fr-FR').length,
				})}]`;
			break;
		}

		default: {
			title = `${upperCaseFirstChar(xpType)} LvL Leaderboard`;
			const XP_ARGUMENT = `${xpType as SkillTypes | DungeonTypes}Xp${offset}` as const;
			dataConverter = (player) => ({
				ign: player.ign,
				discordId: player.discordId,
				xpLastUpdatedAt: player.xpLastUpdatedAt,
				xp: player[XP_ARGUMENT],
				progressLevel: player.getSkillLevel(xpType as SkillTypes | DungeonTypes, offset).progressLevel,
				sortingStat: player[XP_ARGUMENT],
			});
			playerData = getPlayerData(client, hypixelGuild, dataConverter);
			totalStats = oneLine`
				${bold((playerData.reduce((acc, player) => acc + player.progressLevel!, 0) / playerData.length).toFixed(2))}
				[${bold(formatNumber(Math.round(playerData.reduce((acc, player) => acc + player.xp!, 0) / playerData.length)))} XP]
			`;
			getEntry = (player) =>
				`${formatDecimalNumber(player.progressLevel!, { padding: 2 })} [${formatNumber(Math.round(player.xp!), {
					padding: Math.round(playerData[0]?.xp!).toLocaleString('fr-FR').length,
				})} XP]`;
			break;
		}
	}

	// 'your placement'
	const playerRequestingIndex = playerData.findIndex((player) => player.discordId === user.id);

	let playerRequestingEntry: string;

	if (playerRequestingIndex !== -1) {
		const playerRequesting = playerData[playerRequestingIndex]!;

		playerRequestingEntry = codeBlock(
			'ada',
			stripIndent`
			#${`${playerRequestingIndex + 1}`.padStart(3, '0')} : ${playerRequesting.ign}
				 > ${getEntry(playerRequesting)}
		`,
		);
	} else {
		const playerRequesting = UserUtil.getPlayer(user);

		// put playerreq into guildplayers and sort then do the above again
		if (playerRequesting) {
			const playerRequestingConverted = dataConverter(playerRequesting);
			playerRequestingEntry = codeBlock(
				'ada',
				stripIndent`
					#${`${playerData.findIndex(({ sortingStat }) => sortingStat <= playerRequestingConverted.sortingStat) + 1}`.padStart(
						3,
						'0',
					)} : ${playerRequestingConverted.ign}
						 > ${getEntry(playerRequestingConverted)}
				`,
			);
		} else {
			playerRequestingEntry = codeBlock(
				'ada',
				stripIndent`
					#??? : unknown ign
						 > link your discord tag on hypixel
				`,
			);
		}
	}

	if (offset) title += ` (Last ${upperCaseFirstChar(XP_OFFSETS_CONVERTER[offset])})`;

	return {
		title,
		description: `${`${typeof hypixelGuild === 'string' ? 'Guilds' : hypixelGuild} average (${
			playerData.length
		} members): ${totalStats}`.padEnd(62, '\u00A0')}\u200B`,
		playerData,
		playerRequestingEntry,
		getEntry,
		isCompetition: false,
		lastUpdatedAt: offset
			? config.get(XP_OFFSETS_TIME[offset])
			: Math.min(...playerData.map(({ xpLastUpdatedAt }) => xpLastUpdatedAt?.getTime() ?? Number.POSITIVE_INFINITY)),
	};
}
