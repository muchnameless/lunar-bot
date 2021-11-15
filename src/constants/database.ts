import { days, hours, minutes, seconds } from '../functions';
import {
	CATACOMBS_ROLES,
	COSMETIC_SKILLS,
	DELIMITER_ROLES,
	DUNGEON_TYPES,
	DUNGEON_TYPES_AND_CLASSES,
	MAYOR_CHANGE_INTERVAL,
	SKILL_AVERAGE_ROLES,
	SKILL_ROLES,
	SKILLS,
	SKYBLOCK_YEAR_0,
	SLAYER_ROLES,
	SLAYERS,
	SLAYER_TOTAL_ROLES,
} from '.';
import type { HexColorString, Snowflake } from 'discord.js';
import type { ArrayElement } from '../types/util';

// generate default config
export const DEFAULT_CONFIG = {
	AUTO_GUILD_RANKS: true,
	AUTOCORRECT_THRESHOLD: 0.8,
	BRIDGER_ROLE_ID: null,
	CHAT_LOGGING_ENABLED: true,
	CHATBRIDGE_AUTO_MATH: true,
	CHATBRIDGE_AUTOMUTE_DURATION: minutes(30),
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
	DANKER_STAFF_ROLE_ID: null,
	DATABASE_UPDATE_INTERVAL: 5,
	DEFAULT_MAX_PARTS: 5,
	DEFAULT_XP_OFFSET: 'OffsetWeek',
	DISCORD_GUILD_ID: null,
	ELEMENTS_PER_PAGE: 10,
	EMBED_BLUE: '#3498DB',
	EMBED_GREEN: '#2EDD30',
	EMBED_RED: '#E8410E',
	EVAL_INSPECT_DEPTH: 1,
	EVENT_ORGANIZER_ROLE_ID: null,
	EX_GUILD_ROLE_ID: null,
	GUILD_ANNOUNCEMENTS_CHANNEL_ID: null,
	GUILD_ROLE_ID: null,
	HYPIXEL_API_ERROR: false,
	HYPIXEL_SKYBLOCK_API_ERROR: false,
	IMGUR_UPLOADER_CONTENT_TYPE: ['image'],
	IMGUR_UPLOADER_ENABLED: true,
	INACTIVE_ROLE_TIME: days(7),
	INFRACTIONS_EXPIRATION_TIME: minutes(30),
	INGAME_RESPONSE_TIMEOUT: seconds(5),
	KICK_COOLDOWN: hours(1),
	LAST_DAILY_STATS_SAVE_TIME: 0,
	LAST_DAILY_XP_RESET_TIME: 0,
	LAST_KICK_TIME: 0,
	LAST_MAYOR_XP_RESET_TIME: (() => {
		let time = SKYBLOCK_YEAR_0;
		while (time + MAYOR_CHANGE_INTERVAL < Date.now()) time += MAYOR_CHANGE_INTERVAL;
		return time;
	})(),
	LAST_MONTHLY_XP_RESET_TIME: 0,
	LAST_WEEKLY_XP_RESET_TIME: 0,
	LOGGING_CHANNEL_ID: null,
	MAIN_GUILD_ID: null,
	MANAGER_ROLE_ID: null,
	MODERATOR_ROLE_ID: null,
	MOJANG_API_ERROR: false,
	MUTED_ROLE_ID: null,
	NUMBER_FORMAT: 'fr-FR',
	PLAYER_DB_UPDATE_ENABLED: true,
	PREFIXES: ['!', '/'],
	PURGE_LIST_OFFSET: 7,
	REPLY_CONFIRMATION: ['y', 'ye', 'yes'],
	SENIOR_STAFF_ROLE_ID: null,
	SHRUG_ROLE_ID: null,
	STAT_DISCORD_CHANNELS_UPDATE_ENABLED: true,
	TAX_AMOUNT: 1_000_000,
	TAX_AUCTIONS_ITEMS: ['Stone Bricks', 'Stone Brick Slab', 'Spirit Leap'],
	TAX_AUCTIONS_START_TIME: Number.POSITIVE_INFINITY,
	TAX_CHANNEL_ID: null,
	TAX_MESSAGE_ID: null,
	TAX_TRACKING_ENABLED: true,
	TICKET_CHANNELS_CATEGORY_ID: null,
	TRIAL_MODERATOR_ROLE_ID: null,
	USER_INPUT_MAX_RETRIES: 3,
	VERIFIED_ROLE_ID: null,
	WHALECUM_PASS_ROLE_ID: null,
	WHALECUM_PASS_WEIGHT: Number.POSITIVE_INFINITY,
	XP_TRACKING_ENABLED: true,

	// roles
	...Object.fromEntries(DELIMITER_ROLES.map((type) => [`${type}_DELIMITER_ROLE_ID`, null])), // delimiter
	...Object.fromEntries(SKILL_AVERAGE_ROLES.map((level) => [`AVERAGE_LVL_${level}_ROLE_ID`, null])), // skill average
	...Object.fromEntries(SKILLS.flatMap((skill) => SKILL_ROLES.map((level) => [`${skill}_${level}_ROLE_ID`, null]))), // individual SKILLS
	...Object.fromEntries(SLAYER_TOTAL_ROLES.map((level) => [`SLAYER_ALL_${level}_ROLE_ID`, null])), // total slayer
	...Object.fromEntries(SLAYERS.flatMap((slayer) => SLAYER_ROLES.map((level) => [`${slayer}_${level}_ROLE_ID`, null]))), // individual slayer
	...Object.fromEntries(CATACOMBS_ROLES.map((level) => [`CATACOMBS_${level}_ROLE_ID`, null])), // catacombs
} as const;

export type ConfigValues = {
	[key: `${string}_ID`]: Snowflake;

	AUTO_GUILD_RANKS: boolean;
	AUTOCORRECT_THRESHOLD: number;
	CHAT_LOGGING_ENABLED: boolean;
	CHATBRIDGE_AUTO_MATH: boolean;
	CHATBRIDGE_AUTOMUTE_DURATION: number;
	CHATBRIDGE_AUTOMUTE_MAX_INFRACTIONS: number;
	CHATBRIDGE_CHATTRIGGERS_ENABLED: boolean;
	CHATBRIDGE_DEFAULT_MAX_PARTS: number;
	CHATBRIDGE_ENABLED: boolean;
	COMMAND_COOLDOWN_DEFAULT: 1;
	COMPETITION_END_TIME: number;
	COMPETITION_RUNNING: boolean;
	COMPETITION_SCHEDULED: boolean;
	COMPETITION_START_TIME: number;
	CURRENT_COMPETITION: 'lily-weight';
	DATABASE_UPDATE_INTERVAL: number;
	DEFAULT_MAX_PARTS: number;
	DEFAULT_XP_OFFSET: 'OffsetWeek';
	ELEMENTS_PER_PAGE: number;
	EMBED_BLUE: HexColorString;
	EMBED_GREEN: HexColorString;
	EMBED_RED: HexColorString;
	EVAL_INSPECT_DEPTH: number;
	HYPIXEL_API_ERROR: boolean;
	HYPIXEL_SKYBLOCK_API_ERROR: boolean;
	IMGUR_UPLOADER_CONTENT_TYPE: string[];
	IMGUR_UPLOADER_ENABLED: boolean;
	INACTIVE_ROLE_TIME: number;
	INFRACTIONS_EXPIRATION_TIME: number;
	INGAME_RESPONSE_TIMEOUT: number;
	KICK_COOLDOWN: number;
	LAST_DAILY_STATS_SAVE_TIME: number;
	LAST_DAILY_XP_RESET_TIME: number;
	LAST_KICK_TIME: number;
	LAST_MAYOR_XP_RESET_TIME: number;
	LAST_MONTHLY_XP_RESET_TIME: number;
	LAST_WEEKLY_XP_RESET_TIME: number;
	MOJANG_API_ERROR: boolean;
	NUMBER_FORMAT: string;
	PLAYER_DB_UPDATE_ENABLED: boolean;
	PREFIXES: string[];
	PURGE_LIST_OFFSET: number;
	REPLY_CONFIRMATION: string[];
	STAT_DISCORD_CHANNELS_UPDATE_ENABLED: boolean;
	TAX_AMOUNT: number;
	TAX_AUCTIONS_ITEMS: string[];
	TAX_AUCTIONS_START_TIME: number;
	TAX_TRACKING_ENABLED: number;
	USER_INPUT_MAX_RETRIES: number;
	WHALECUM_PASS_WEIGHT: number;
	XP_TRACKING_ENABLED: boolean;
};

export const OFFSET_FLAGS = {
	COMPETITION_END: 'CompetitionEnd',
	COMPETITION_START: 'CompetitionStart',
	MAYOR: 'OffsetMayor',
	WEEK: 'OffsetWeek',
	MONTH: 'OffsetMonth',
	CURRENT: 'current',
	DAY: 'day',
} as const;

export const XP_OFFSETS = ['CompetitionStart', 'CompetitionEnd', 'OffsetMayor', 'OffsetWeek', 'OffsetMonth'] as const;

export const XP_OFFSETS_SHORT = {
	competition: 'CompetitionStart',
	mayor: 'OffsetMayor',
	week: 'OffsetWeek',
	month: 'OffsetMonth',
} as const;

export const XP_OFFSETS_CONVERTER = {
	competition: 'CompetitionStart',
	mayor: 'OffsetMayor',
	week: 'OffsetWeek',
	month: 'OffsetMonth',

	CompetitionStart: 'competition',
	OffsetMayor: 'mayor',
	OffsetWeek: 'week',
	OffsetMonth: 'month',
} as const;

export const XP_OFFSETS_TIME = {
	CompetitionStart: 'COMPETITION_START_TIME',
	CompetitionEnd: 'COMPETITION_END_TIME',
	OffsetMayor: 'LAST_MAYOR_XP_RESET_TIME',
	OffsetWeek: 'LAST_WEEKLY_XP_RESET_TIME',
	OffsetMonth: 'LAST_MONTHLY_XP_RESET_TIME',
	day: 'LAST_DAILY_XP_RESET_TIME',
} as const;

export type XPOffsets = ArrayElement<typeof XP_OFFSETS> | '';

export const SKYBLOCK_XP_TYPES = [...SKILLS, ...COSMETIC_SKILLS, ...SLAYERS, ...DUNGEON_TYPES_AND_CLASSES] as const;
export const XP_TYPES = [...SKYBLOCK_XP_TYPES, 'guild'] as const;
export const XP_AND_DATA_TYPES = [
	...XP_TYPES,
	...DUNGEON_TYPES.flatMap((type) => [`${type}Completions`, `${type}MasterCompletions`] as const),
] as const;

const XP_TYPES_SET = new Set(XP_TYPES);
export const isXPType = (type: unknown): type is XPTypes => XP_TYPES_SET.has(type as XPTypes);

export type XPTypes = ArrayElement<typeof XP_TYPES>;
export type XPAndDataTypes = ArrayElement<typeof XP_AND_DATA_TYPES>;

export const LEADERBOARD_XP_TYPES = [
	'lily-weight',
	'senither-weight',
	'skill-average',
	...SKILLS,
	...COSMETIC_SKILLS,
	'slayer',
	...SLAYERS,
	...DUNGEON_TYPES_AND_CLASSES,
	'guild',
] as const;

// IGNs
export const UNKNOWN_IGN = 'UNKNOWN_IGN';

// guild Ids
export const GUILD_ID_ERROR = 'ERROR';
export const GUILD_ID_BRIDGER = 'BRIDGER';
export const GUILD_ID_ALL = 'ALL';
