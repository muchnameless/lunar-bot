import { days, minutes, seconds } from '../functions';
import {
	COSMETIC_SKILLS,
	DUNGEON_TYPES,
	DUNGEON_TYPES_AND_CLASSES,
	MAYOR_CHANGE_INTERVAL,
	SKILLS,
	SKYBLOCK_YEAR_0,
	SLAYERS,
} from '.';
import type { Snowflake } from 'discord.js';
import type { ArrayElementType, Mutable } from '@sapphire/utilities';

// generate default config
export const DEFAULT_CONFIG = {
	AUTO_GUILD_RANKS: true,
	AUTOCORRECT_THRESHOLD: 0.8,
	CHATBRIDGE_AUTO_MATH: true,
	CHATBRIDGE_AUTOMUTE_DURATION: minutes(10),
	CHATBRIDGE_AUTOMUTE_MAX_INFRACTIONS: 3,
	CHATBRIDGE_CHATTRIGGERS_ENABLED: true,
	CHATBRIDGE_DEFAULT_MAX_PARTS: 5,
	CHATBRIDGE_ENABLED: true,
	COMMAND_COOLDOWN_DEFAULT: 1,
	COMPETITION_END_TIME: Number.POSITIVE_INFINITY,
	COMPETITION_RUNNING: false,
	COMPETITION_SCHEDULED: false,
	COMPETITION_START_TIME: Number.POSITIVE_INFINITY,
	CURRENT_COMPETITION: 'lily-weight',
	DATABASE_UPDATE_INTERVAL: 5,
	DEFAULT_MAX_PARTS: 5,
	DEFAULT_XP_OFFSET: Offset.Week,
	ELEMENTS_PER_PAGE: 10,
	EMBED_BLUE: 0x34_98_db,
	EMBED_GREEN: 0x2e_dd_30,
	EMBED_RED: 0xe8_41_0e,
	EVAL_INSPECT_DEPTH: 1,
	HYPIXEL_API_ERROR: false,
	HYPIXEL_FORUM_LAST_GUID: 0,
	HYPIXEL_SKYBLOCK_API_ERROR: false,
	IGN_UPDATE_ENABLED: true,
	IGN_UPDATE_INTERVAL: 20,
	IMGUR_UPLOADER_CONTENT_TYPE: ['image'],
	IMGUR_UPLOADER_ENABLED: true,
	INACTIVE_ROLE_TIME: days(7),
	INGAME_RESPONSE_TIMEOUT: seconds(5),
	LAST_DAILY_STATS_SAVE_TIME: 0,
	LAST_DAILY_XP_RESET_TIME: 0,
	LAST_MAYOR_XP_RESET_TIME: (() => {
		let time = SKYBLOCK_YEAR_0;
		while (time + MAYOR_CHANGE_INTERVAL < Date.now()) time += MAYOR_CHANGE_INTERVAL;
		return time;
	})(),
	LAST_MONTHLY_XP_RESET_TIME: 0,
	LAST_WEEKLY_XP_RESET_TIME: 0,
	LOGGING_CHANNEL_ID: null,
	MAIN_GUILD_ID: null,
	MOJANG_API_ERROR: false,
	PLAYER_DB_UPDATE_ENABLED: true,
	PREFIXES: ['!'],
	PURGE_LIST_OFFSET: 7,
	REPLY_CONFIRMATION: ['y', 'ye', 'yes'],
	STAT_DISCORD_CHANNELS_UPDATE_ENABLED: true,
	TAX_AMOUNT: 1_000_000,
	TAX_AUCTIONS_ITEMS: ['Stone Bricks', 'Stone Brick Slab', 'Spirit Leap'],
	TAX_AUCTIONS_START_TIME: Number.POSITIVE_INFINITY,
	TAX_CHANNEL_ID: null,
	TAX_MESSAGE_ID: null,
	TAX_TRACKING_ENABLED: true,
	USER_INPUT_MAX_RETRIES: 3,
	XP_TRACKING_ENABLED: true,
} as const;

type Loosen<T> = {
	-readonly [P in keyof T]: T[P] extends Offset
		? Offset.Week
		: T[P] extends string
		? string
		: T[P] extends number
		? number
		: T[P] extends boolean
		? boolean
		: T[P] extends null
		? Snowflake // Ids default to null
		: T[P] extends [...infer E]
		? ArrayElementType<Loosen<E>>[]
		: T[P];
};

export type ConfigValues = Loosen<Mutable<typeof DEFAULT_CONFIG>>;

export const enum Offset {
	CompetitionEnd = 'CompetitionEnd',
	CompetitionStart = 'CompetitionStart',
	Mayor = 'OffsetMayor',
	Week = 'OffsetWeek',
	Month = 'OffsetMonth',
	Current = 'current',
	Day = 'day',
}

export const XP_OFFSETS = [
	Offset.CompetitionEnd,
	Offset.CompetitionStart,
	Offset.Mayor,
	Offset.Week,
	Offset.Month,
] as const;

export const XP_OFFSETS_SHORT = {
	competition: Offset.CompetitionStart,
	mayor: Offset.Mayor,
	week: Offset.Week,
	month: Offset.Month,
} as const;

export const XP_OFFSETS_CONVERTER = {
	...XP_OFFSETS_SHORT,

	[Offset.CompetitionStart]: 'competition',
	[Offset.Mayor]: 'mayor',
	[Offset.Week]: 'week',
	[Offset.Month]: 'month',
} as const;

export const XP_OFFSETS_TIME = {
	[Offset.CompetitionStart]: 'COMPETITION_START_TIME',
	[Offset.CompetitionEnd]: 'COMPETITION_END_TIME',
	[Offset.Mayor]: 'LAST_MAYOR_XP_RESET_TIME',
	[Offset.Week]: 'LAST_WEEKLY_XP_RESET_TIME',
	[Offset.Month]: 'LAST_MONTHLY_XP_RESET_TIME',
	[Offset.Day]: 'LAST_DAILY_XP_RESET_TIME',
} as const;

export type XPOffsets = ArrayElementType<typeof XP_OFFSETS> | '';

export const SKYBLOCK_XP_TYPES = [...SKILLS, ...COSMETIC_SKILLS, ...SLAYERS, ...DUNGEON_TYPES_AND_CLASSES] as const;
export const XP_TYPES = [...SKYBLOCK_XP_TYPES, 'guild'] as const;
export const XP_AND_DATA_TYPES = [
	...XP_TYPES,
	...DUNGEON_TYPES.flatMap((type) => [`${type}Completions`, `${type}MasterCompletions`] as const),
] as const;

const XP_TYPES_SET = new Set(XP_TYPES);
export const isXPType = (type: unknown): type is XPTypes => XP_TYPES_SET.has(type as XPTypes);

export type XPTypes = ArrayElementType<typeof XP_TYPES>;
export type XPAndDataTypes = ArrayElementType<typeof XP_AND_DATA_TYPES>;

export const LEADERBOARD_XP_TYPES = [
	'lily-weight',
	'senither-weight',
	'skill-average',
	...SKILLS,
	// TODO: refactor xpTypeOption to autocomplete
	// ...COSMETIC_SKILLS,
	'slayer',
	...SLAYERS,
	...DUNGEON_TYPES_AND_CLASSES,
	'guild',
] as const;

// IGNs
export const UNKNOWN_IGN = 'UNKNOWN_IGN';

// guild Ids
export const GUILD_ID_ERROR = 'ERROR';
export const GUILD_ID_ALL = 'ALL';
