'use strict';

const { SKILLS, COSMETIC_SKILLS, SLAYERS, DUNGEON_TYPES, DUNGEON_CLASSES } = require('./skyblock');


module.exports = {

	offsetFlags: {
		COMPETITION_END: 'CompetitionEnd',
		COMPETITION_START: 'CompetitionStart',
		MAYOR: 'OffsetMayor',
		WEEK: 'OffsetWeek',
		MONTH: 'OffsetMonth',
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
		// day: 'day',
	},

	XP_OFFSETS_CONVERTER: {
		competition: 'CompetitionStart',
		mayor: 'OffsetMayor',
		week: 'OffsetWeek',
		month: 'OffsetMonth',
		// day: 'day',

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

	XP_TYPES: [ ...SKILLS, ...COSMETIC_SKILLS, ...SLAYERS, ...DUNGEON_TYPES, ...DUNGEON_CLASSES, 'guild' ],

	UNKNOWN_IGN: 'unknown ign',

	GUILD_ID_ERROR: 'error',

};
