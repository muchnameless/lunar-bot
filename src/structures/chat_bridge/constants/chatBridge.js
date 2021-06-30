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

	blockedWordsRegExp: /\bsex\b|\bcum\b|\bsemen\b|nutte(?:d|r)|\bjerk +of|\bboner\b|\borgy\b|\bth[o0]t\b|pussy|orgasm|\ba+n+a+l+\b|suck +my +dick|nude|\bp+ornhub+(?:\..+)?\b|\bxhamster(?:\..+)?\b|\bpedo(?:phile|s)?\b|(?:you'?r+?e?|(?:your|ur) +(?:m[uo]m|dad)) +gay+\b|fa(g+o+|g{2,})t|f(?:4|@)g|cocain|\bh+e+r+o+i+n+\b|\bk+ys+\b|(?:kill.+?|sho{2,}t+) +y *o *u *r *s *e *l *f+\b|school *shoot|get +aids|autist|\bsuicide\b|\bslave\b|brain *dead|retarted|\bn+i[bg]{2,}(?:er+|a+)\b|\bniga*\b|\bchang\b|\bcoon+\b|\bhurri\b|\bk{3,}\b|\br+ape+\b|kkr|hope +you +die|die +tmr|\bcok\b/i,

	memeRegExp: /[⠁-⣿]/,

	nonWhiteSpaceRegExp: new RegExp(`[^\\s\u{2003}\u{2800}\u{0020}\u{180E}\u{200B}${invisibleCharacters.join('')}]`, 'u'),
};
