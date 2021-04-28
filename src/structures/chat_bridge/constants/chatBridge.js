'use strict';

/**
 * characters that don't render in mc chat
 */
const invisibleCharacters = [
	'\u{2B4D}', // '⭍'
	'\u{800}', // 'ࠀ'
	'\u{58F}', // '֏'
	'\u{A8F0}', // '꣰'
];

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

	invisibleCharacters,

	randomInvisibleCharacter: () => invisibleCharacters[Math.floor(Math.random() * invisibleCharacters.length)],

	invisibleCharacterRegExp: new RegExp(invisibleCharacters.join('|'), 'gu'),

	/**
	 * any non-'-' and non-whitespace
	 */
	defaultResponseRegExp: /[^-\s\u{2003}\u{2800}\u{0020}\u{180E}\u{200B}]/u,

	blockedWordsRegExp: /\bsex\b|\bcum\b|nutte(?:d|r)|\bthot\b|pussy|\bpedo(?:phile|s)?\b|\byou'?r+?e? gay+\b|\bk+ys+\b|kil.+? yourself+\b|get aids|\bsuicide\b|braindead|\bchang\b|\bn+ig{2,}er+\b|\bk{3,}\b|\br+ape+\b|shoot yourself+\b|kkr|hope you die|\bmomo\b/i,

	memeRegExp: /[⠁-⣿]/,

	nonWhiteSpaceRegExp: new RegExp(`[^\\s\u{2003}\u{2800}\u{0020}\u{180E}\u{200B}${invisibleCharacters.join('')}]`, 'u'),
};
