'use strict';

const { skills, cosmeticSkills, slayers, dungeonTypes, dungeonClasses } = require('./skyblock');


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

};
