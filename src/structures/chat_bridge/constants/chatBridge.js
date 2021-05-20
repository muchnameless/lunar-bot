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
		'keep_alive',
	],

	messageTypes: {
		WHISPER: 'whisper',
		GUILD: 'guild',
		OFFICER: 'officer',
		PARTY: 'party',
	},

	prefixByType: {
		guild: '/gc',
		officer: '/oc',
		party: '/pc',
	},

	chatFunctionByType: {
		guild: 'gchat',
		officer: 'ochat',
		party: 'pchat',
	},

	invisibleCharacters,

	randomInvisibleCharacter: () => invisibleCharacters[Math.floor(Math.random() * invisibleCharacters.length)],

	invisibleCharacterRegExp: new RegExp(invisibleCharacters.join('|'), 'gu'),

	/**
	 * any non-'-' and non-whitespace
	 */
	defaultResponseRegExp: /[^-\s\u{2003}\u{2800}\u{0020}\u{180E}\u{200B}]/u,

	blockedWordsRegExp: /\bsex\b|\bcum\b|nutte(?:d|r)|\bthot\b|pussy|suck my dick|nude|\bp+ornhub+(?:\..+)?\b|\bxhamster(?:\..+)?\b|\bpedo(?:phile|s)?\b|\b(?:you'?r+?e?|ur)(?: mom| dad)? gay+\b|fa(g+o+|g{2,})t|cocain|\bh+e+r+o+i+n+\b|\bk+ys+\b|kil.+? yourself+\b|school\s*shoot|get aids|autist|\bsuicide\b|\bslave\b|braindead|\bchang\b|\bn+i[bg]{2,}(?:er+|a+)\b|\bcoon+\b|\bk{3,}\b|\br+ape+\b|shoot yourself+\b|kkr|hope you die|\bmomo\b/i,

	memeRegExp: /[⠁-⣿]/,

	nonWhiteSpaceRegExp: new RegExp(`[^\\s\u{2003}\u{2800}\u{0020}\u{180E}\u{200B}${invisibleCharacters.join('')}]`, 'u'),
};
