'use strict';

const { skills, cosmeticSkills, slayers, dungeonTypes, dungeonClasses, SKYBLOCK_YEAR_0, MAYOR_CHANGE_INTERVAL } = require('./skyblock');
const { delimiterRoles, skillAverageRoles, skillRoles, slayerTotalRoles, slayerRoles, catacombsRoles } = require('./roles');

// generate default config
const DEFAULT_CONFIG = {
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
	COMMAND_COOLDOWN_DEFAULT: 1,
	COMPETITION_END_TIME: Infinity,
	COMPETITION_RUNNING: false,
	COMPETITION_SCHEDULED: false,
	COMPETITION_START_TIME: Infinity,
	CURRENT_COMPETITION: 'weight',
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
	EXTENDED_LOGGING_ENABLED: false,
	GUILD_ANNOUNCEMENTS_CHANNEL_ID: null,
	GUILD_ROLE_ID: null,
	HYPIXEL_API_ERROR: false,
	HYPIXEL_SKYBLOCK_API_ERROR: false,
	INFRACTIONS_EXPIRATION_TIME: 3_600_000,
	INGAME_RESPONSE_TIMEOUT: 5_000,
	LAST_DAILY_STATS_SAVE_TIME: 0,
	LAST_DAILY_XP_RESET_TIME: 0,
	LAST_MAYOR_XP_RESET_TIME: SKYBLOCK_YEAR_0,
	LAST_MONTHLY_XP_RESET_TIME: 0,
	LAST_WEEKLY_XP_RESET_TIME: 0,
	LOGGING_CHANNEL_ID: null,
	MAIN_GUILD_ID: null,
	MANAGER_ROLE_ID: null,
	MODERATOR_ROLE_ID: null,
	MUTED_ROLE_ID: null,
	NUMBER_FORMAT: 'fr-FR',
	PLAYER_DB_UPDATE_ENABLED: true,
	PREFIXES: [ 'lg!', '!', '/' ],
	PURGE_LIST_OFFSET: 7,
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
};

while (DEFAULT_CONFIG.LAST_MAYOR_XP_RESET_TIME + MAYOR_CHANGE_INTERVAL < Date.now()) DEFAULT_CONFIG.LAST_MAYOR_XP_RESET_TIME += MAYOR_CHANGE_INTERVAL;

for (const type of delimiterRoles) DEFAULT_CONFIG[`${type}_DELIMITER_ROLE_ID`] = null; // delimiter

for (const level of skillAverageRoles) DEFAULT_CONFIG[`AVERAGE_LVL_${level}_ROLE_ID`] = null; // skill average

for (const skill of skills) for (const level of skillRoles) DEFAULT_CONFIG[`${skill}_${level}_ROLE_ID`] = null; // individual skills

for (const level of slayerTotalRoles) DEFAULT_CONFIG[`SLAYER_ALL_${level}_ROLE_ID`] = null; // total slayer

for (const slayer of slayers) for (const level of slayerRoles) DEFAULT_CONFIG[`${slayer}_${level}_ROLE_ID`] = null; // individual slayer

for (const level of catacombsRoles) DEFAULT_CONFIG[`CATACOMBS_${level}_ROLE_ID`] = null; // catacombs

Object.freeze(DEFAULT_CONFIG);


module.exports = {

	offsetFlags: {
		COMPETITION_END: 'CompetitionEnd',
		COMPETITION_START: 'CompetitionStart',
		MAYOR: 'OffsetMayor',
		WEEK: 'OffsetWeek',
		MONTH: 'OffsetMonth',
		CURRENT: 'current',
		DAY: 'day',
	},

	XP_OFFSETS: [
		'CompetitionStart',
		'CompetitionEnd',
		'OffsetMayor',
		'OffsetWeek',
		'OffsetMonth',
	],

	XP_OFFSETS_SHORT: {
		competition: 'CompetitionStart',
		mayor: 'OffsetMayor',
		week: 'OffsetWeek',
		month: 'OffsetMonth',
	},

	XP_OFFSETS_CONVERTER: {
		competition: 'CompetitionStart',
		mayor: 'OffsetMayor',
		week: 'OffsetWeek',
		month: 'OffsetMonth',

		CompetitionStart: 'competition',
		OffsetMayor: 'mayor',
		OffsetWeek: 'week',
		OffsetMonth: 'month',
	},

	XP_OFFSETS_TIME: {
		CompetitionStart: 'COMPETITION_START_TIME',
		CompetitionEnd: 'COMPETITION_END_TIME',
		OffsetMayor: 'LAST_MAYOR_XP_RESET_TIME',
		OffsetWeek: 'LAST_WEEKLY_XP_RESET_TIME',
		OffsetMonth: 'LAST_MONTHLY_XP_RESET_TIME',
		day: 'LAST_DAILY_XP_RESET_TIME',
	},

	XP_TYPES: [ ...skills, ...cosmeticSkills, ...slayers, ...dungeonTypes, ...dungeonClasses, 'guild' ],

	UNKNOWN_IGN: 'UNKNOWN_IGN',

	GUILD_ID_ERROR: 'ERROR',

	GUILD_ID_BRIDGER: 'BRIDGER',

	GUILD_ID_ALL: 'ALL',

	DEFAULT_CONFIG,

};
