'use strict';

module.exports = {
	/**
	 * mc client version
	 */
	VERSION: '1.16.5',

	/**
	 * bot events that should only be listened to once
	 */
	spawnEvents: [
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

	HYPIXEL_RANK_REGEX: '(?:\\[.+?\\] )?',

	GUILD_RANK_REGEX: '(?:\\w+)\\])?',

	/**
	 * characters that don't render in mc chat
	 */
	invisibleCharacters: [
		'⭍',
		'ࠀ',
	],
};
