'use strict';

module.exports = {
	/**
	 * bot events that should only be listened to once
	 */
	spawnEvents: [
		'login',
		'update_health',
	],

	messageTypes: {
		WHISPER: 'whisper',
		GUILD: 'guild',
		OFFICER: 'officer',
		PARTY: 'party',
	},

	/**
	 * characters that don't render in mc chat
	 */
	invisibleCharacters: [
		'⭍',
		'ࠀ',
	],
};
