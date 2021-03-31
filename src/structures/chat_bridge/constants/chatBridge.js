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

	/**
	 * any non-'-' and non-whitespace
	 */
	defaultResponseRegExp: /[^-\s\u{2003}\u{2800}\u{0020}\u{180E}\u{200B}]/u,

	blockedWordsRegExp: /\bsex\b|\bcum\b|nutted|\bpedo(?:phile)?\b|\byou'?r+?e? gay+\b|\bk+ys+\b|kil.+? yourself+\b|\bsuicide\b|\bn+igger+\b|\bk{3,}\b|\br+ape+\b|s+hoot yourself+\b|kkr|hope you die|\bmomo\b/i,

	memeRegExp: /[⠁-⣿]/,

	nonWhiteSpaceRegExp: /[^\s\u{2003}\u{2800}\u{0020}\u{180E}\u{200B}ࠀ⭍]/u,
};
