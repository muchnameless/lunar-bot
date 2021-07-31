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

	blockedWordsRegExp: /\b(?:cyber)?s[e3]x\b|seks|\bcum(?:shot)?\b|\bsemen\b|\br+ape+d*\b|nutte(?:d|r)|\bjerk +of|suck +me +off|\bb[o0]n[e3]r\b|schl[o0]ng|\borgy\b|\bth[o0]t\b|pus{2,}y|orgasm|\ba+n+a+l+\b|suck +my +dick|nude|\bp+ornhub+(?:\..+)?\b|\bxhamster(?:\..+)?\b|\bp[e3]do(?:phile|s)?\b|(?:you'?r+?e?|ur|(?:your|ur) +(?:m[uo]m|dad)|\bs?he +is) +gay+\b|ur gae|fa(g+o+|g{2,})t|f(?:4|@)g|cocain|\bh+e+r+o+i+n+\b|\bk+ys+\b|(?:kill.*|sho{2,}t+) +y *o *u *r *s *e *l *f+\b|kil{2,}m+y+ *s+elf|school *shoot|get +aids|autist|\bsuicide\b|\bslave\b|brain *dead|retarted|deranged|\bn+i(?:b{2,}|g{2,})(?:er+|a+)\b|\bnig+a*\b|\bch[ai]ng\b|\bco{2,}n+s*\b|\bhurri\b|\bk{3,}\b|\br+ape+\b|kkr|hope +you +die|die +tmr|go +die +in +a +hole|\bcok\b|kanker/i,

	memeRegExp: /[⠁-⣿]/,

	nonWhiteSpaceRegExp: new RegExp(`[^\\s\u{2003}\u{2800}\u{0020}\u{180E}\u{200B}${invisibleCharacters.join('')}]`, 'u'),
};
