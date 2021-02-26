'use strict';

module.exports = {
	VERSION: '1.16.5',

	SPAWN_EVENTS: [
		'login',
		'update_health',
	],

	defaultSettings: {
		locale: 'en_US',
		viewDistance: 6, // tiny
		chatFlags: 0, // enabled
		chatColors: true,
		skinParts: 0,
		mainHand: 1,
	},

	messageTypes: {
		WHISPER: 'whisper',
		GUILD: 'guild',
		PARTY: 'party',
	},
};
