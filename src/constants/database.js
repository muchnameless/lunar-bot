import {
	CATACOMBS_ROLES,
	DELIMITER_ROLES,
	MAYOR_CHANGE_INTERVAL,
	SKILL_AVERAGE_ROLES,
	SKILL_ROLES,
	SKILLS,
	SKYBLOCK_YEAR_0,
	SLAYER_ROLES,
	SLAYERS,
	SLAYER_TOTAL_ROLES,
} from './index.js';
import { transformAPIData } from '../functions/index.js';


// generate default config
export const DEFAULT_CONFIG = Object.freeze({
	AUTO_GUILD_RANKS: true,
	AUTOCORRECT_THRESHOLD: 0.8,
	AVERAGE_STATS_CHANNEL_UPDATE_ENABLED: true,
	BRIDGER_ROLE_ID: null,
	CATACOMBS_AVERAGE_STATS_CHANNEL_ID: null,
	CHAT_LOGGING_ENABLED: true,
	CHATBRIDGE_AUTO_MATH: true,
	CHATBRIDGE_AUTOMUTE_DURATION: 1_800_000,
	CHATBRIDGE_AUTOMUTE_MAX_INFRACTIONS: 3,
	CHATBRIDGE_CHATTRIGGERS_ENABLED: true,
	CHATBRIDGE_DEFAULT_MAX_PARTS: 5,
	CHATBRIDGE_ENABLED: true,
	CHATBRIDGE_IMGUR_UPLOADER_ENABLED: true,
	COMMAND_COOLDOWN_DEFAULT: 1,
	COMPETITION_END_TIME: Infinity,
	COMPETITION_RUNNING: false,
	COMPETITION_SCHEDULED: false,
	COMPETITION_START_TIME: Infinity,
	CURRENT_COMPETITION: 'weight',
	DANKER_STAFF_ROLE_ID: null,
	DATA_HISTORY_MAX_LENGTH: 30,
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
	IMGUR_UPLOADER_CONTENT_TYPE: [ 'image' ],
	INFRACTIONS_EXPIRATION_TIME: 1_800_000,
	INGAME_RESPONSE_TIMEOUT: 5_000,
	KICK_COOLDOWN: 3_600_000,
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
	PREFIXES: [ 'lg!', '!', '/' ],
	PURGE_LIST_OFFSET: 7,
	REPLY_CONFIRMATION: [ 'y', 'ye', 'yes' ],
	SENIOR_STAFF_ROLE_ID: null,
	SHRUG_ROLE_ID: null,
	SKILL_AVERAGE_STATS_CHANNEL_ID: null,
	SLAYER_AVERAGE_STATS_CHANNEL_ID: null,
	TAX_AMOUNT: 1_000_000,
	TAX_AUCTIONS_ITEMS: [ 'Stone Bricks', 'Stone Brick Slab', 'Spirit Leap' ],
	TAX_AUCTIONS_START_TIME: Infinity,
	TAX_CHANNEL_ID: null,
	TAX_MESSAGE_ID: null,
	TAX_TRACKING_ENABLED: true,
	TICKET_CHANNELS_CATEGORY_ID: null,
	TRIAL_MODERATOR_ROLE_ID: null,
	USER_INPUT_MAX_RETRIES: 3,
	VERIFIED_ROLE_ID: null,
	WHALECUM_PASS_ROLE_ID: null,
	WHALECUM_PASS_WEIGHT: Infinity,
	WEIGHT_AVERAGE_STATS_CHANNEL_ID: null,
	XP_TRACKING_ENABLED: true,

	// roles
	...Object.fromEntries(DELIMITER_ROLES.map(type => [ `${type}_DELIMITER_ROLE_ID`, null ])), // delimiter
	...Object.fromEntries(SKILL_AVERAGE_ROLES.map(level => [ `AVERAGE_LVL_${level}_ROLE_ID`, null ])), // skill average
	...Object.fromEntries(SKILLS.flatMap(skill => SKILL_ROLES.map(level => [ `${skill}_${level}_ROLE_ID`, null ]))), // individual SKILLS
	...Object.fromEntries(SLAYER_TOTAL_ROLES.map(level => [ `SLAYER_ALL_${level}_ROLE_ID`, null ])), // total slayer
	...Object.fromEntries(SLAYERS.flatMap(slayer => SLAYER_ROLES.map(level => [ `${slayer}_${level}_ROLE_ID`, null ]))), // individual slayer
	...Object.fromEntries(CATACOMBS_ROLES.map(level => [ `CATACOMBS_${level}_ROLE_ID`, null ])), // catacombs
});

export const OFFSET_FLAGS = Object.freeze({
	COMPETITION_END: 'CompetitionEnd',
	COMPETITION_START: 'CompetitionStart',
	MAYOR: 'OffsetMayor',
	WEEK: 'OffsetWeek',
	MONTH: 'OffsetMonth',
	CURRENT: 'current',
	DAY: 'day',
});

export const XP_OFFSETS = Object.freeze([
	'CompetitionStart',
	'CompetitionEnd',
	'OffsetMayor',
	'OffsetWeek',
	'OffsetMonth',
]);

export const XP_OFFSETS_SHORT = Object.freeze({
	competition: 'CompetitionStart',
	mayor: 'OffsetMayor',
	week: 'OffsetWeek',
	month: 'OffsetMonth',
});

export const XP_OFFSETS_CONVERTER = Object.freeze({
	competition: 'CompetitionStart',
	mayor: 'OffsetMayor',
	week: 'OffsetWeek',
	month: 'OffsetMonth',

	CompetitionStart: 'competition',
	OffsetMayor: 'mayor',
	OffsetWeek: 'week',
	OffsetMonth: 'month',
});

export const XP_OFFSETS_TIME = Object.freeze({
	CompetitionStart: 'COMPETITION_START_TIME',
	CompetitionEnd: 'COMPETITION_END_TIME',
	OffsetMayor: 'LAST_MAYOR_XP_RESET_TIME',
	OffsetWeek: 'LAST_WEEKLY_XP_RESET_TIME',
	OffsetMonth: 'LAST_MONTHLY_XP_RESET_TIME',
	day: 'LAST_DAILY_XP_RESET_TIME',
});


export const SKYBLOCK_DATA = Object.freeze(transformAPIData());

export const XP_TYPES = Object.freeze(Object.keys(SKYBLOCK_DATA).filter(key => key.endsWith('Xp') || key.startsWith('dungeon')));

export const HISTORY_KEYS = Object.freeze([
	'skyBlockData',
	'guildXp',
].map(key => [ key, `${key}History` ]));


export const UNKNOWN_IGN = 'UNKNOWN_IGN';

export const GUILD_ID_ERROR = 'ERROR';
export const GUILD_ID_BRIDGER = 'BRIDGER';
export const GUILD_ID_ALL = 'ALL';
