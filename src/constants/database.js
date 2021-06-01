'use strict';

const { skills, cosmeticSkills, slayers, dungeonTypes, dungeonClasses } = require('./skyblock');
const { delimiterRoles, skillAverageRoles, skillRoles, slayerTotalRoles, slayerRoles, catacombsRoles } = require('./roles');

// generate default config
const DEFAULT_CONFIG = {
	AUTOCORRECT_THRESHOLD: 0.75,
	AVERAGE_STATS_CHANNEL_UPDATE_ENABLED: true,
	BRIDGER_ROLE_ID: 0,
	CATACOMBS_AVERAGE_STATS_CHANNEL_ID: 0,
	CHAT_LOGGING_ENABLED: true,
	CHATBRIDGE_AUTOMUTE_DURATION: 1800000,
	CHATBRIDGE_AUTOMUTE_MAX_INFRACTIONS: 3,
	CHATBRIDGE_DEFAULT_MAX_PARTS: 5,
	CHATBRIDGE_ENABLED: true,
	COMMAND_COOLDOWN_DEFAULT: 1,
	COMPETITION_END_TIME: 0,
	COMPETITION_RUNNING: false,
	COMPETITION_SCHEDULED: false,
	COMPETITION_START_TIME: 0,
	CURRENT_COMPETITION: 'weight',
	DATABASE_UPDATE_INTERVAL: 5,
	DEFAULT_MAX_PARTS: 5,
	DEFAULT_XP_OFFSET: 'OffsetWeek',
	DISCORD_GUILD_ID: 0,
	ELEMENTS_PER_PAGE: 10,
	EMBED_BLUE: '#3498DB',
	EMBED_GREEN: '#2EDD30',
	EMBED_RED: '#E8410E',
	EVENT_ORGANIZER_ROLE_ID: 0,
	EX_GUILD_ROLE_ID: 0,
	EXTENDED_LOGGING_ENABLED: false,
	GUILD_ANNOUNCEMENTS_CHANNEL_ID: 0,
	GUILD_ROLE_ID: 0,
	HYPIXEL_API_ERROR: false,
	HYPIXEL_SKYBLOCK_API_ERROR: false,
	INFRACTIONS_EXPIRATION_TIME: 3600000,
	INGAME_PREFIX: '!',
	INGAME_RESPONSE_TIMEOUT: 5000,
	LAST_DAILY_STATS_SAVE_TIME: 0,
	LAST_DAILY_XP_RESET_TIME: 0,
	LAST_MAYOR_XP_RESET_TIME: 0,
	LAST_MONTHLY_XP_RESET_TIME: 0,
	LAST_WEEKLY_XP_RESET_TIME: 0,
	LOGGING_WEBHOOK_DELETED: false,
	MAIN_GUILD_ID: 0,
	MANAGER_ROLE_ID: 0,
	MODERATOR_ROLE_ID: 0,
	MUTED_ROLE_ID: 0,
	NUMBER_FORMAT: 'fr-FR',
	PLAYER_DB_UPDATE_ENABLED: true,
	PREFIX: 'lg!',
	PURGE_LIST_OFFSET: 7,
	REPLY_CONFIRMATION: 'y,ye,yes',
	SENIOR_STAFF_ROLE_ID: 0,
	SHRUG_ROLE_ID: 0,
	SKILL_AVERAGE_STATS_CHANNEL_ID: 0,
	SLAYER_AVERAGE_STATS_CHANNEL_ID: 0,
	TAX_AMOUNT: 1000000,
	TAX_AUCTIONS_ITEMS: 'Stone Bricks,Stone Brick Slab,Spirit Leap',
	TAX_AUCTIONS_START_TIME: 0,
	TAX_CHANNEL_ID: 0,
	TAX_MESSAGE_ID: 0,
	TAX_TRACKING_ENABLED: true,
	TICKET_CHANNELS_CATEGORY_ID: 0,
	TRIAL_MODERATOR_ROLE_ID: 0,
	USER_INPUT_MAX_RETRIES: 3,
	VERIFIED_ROLE_ID: 0,
	WEIGHT_AVERAGE_STATS_CHANNEL_ID: 0,
	XP_TRACKING_ENABLED: true,
};

for (const type of delimiterRoles) DEFAULT_CONFIG[`${type}_DELIMITER_ROLE_ID`] = 0; // delimiter

for (const level of skillAverageRoles) DEFAULT_CONFIG[`AVERAGE_LVL_${level}_ROLE_ID`] = 0; // skill average

for (const skill of skills) for (const level of skillRoles) DEFAULT_CONFIG[`${skill}_${level}_ROLE_ID`] = 0; // individual skills

for (const level of slayerTotalRoles) DEFAULT_CONFIG[`SLAYER_ALL_${level}_ROLE_ID`] = 0; // total slayer

for (const slayer of slayers) for (const level of slayerRoles) DEFAULT_CONFIG[`${slayer}_${level}_ROLE_ID`] = 0; // individual slayer

for (const level of catacombsRoles) DEFAULT_CONFIG[`CATACOMBS_${level}_ROLE_ID`] = 0; // catacombs

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

	DEFAULT_CONFIG,

};
