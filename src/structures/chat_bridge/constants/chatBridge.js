'use strict';

/**
 * characters that don't render in mc chat
 */
const invisibleCharacters = [
	'\u{2B4D}', // '⭍'
	'\u{800}', // 'ࠀ'
	'\u{58F}', // '֏'
	'\u{A8F0}', // '꣰'
	'\u{26D3}', // '⛓'
	'\u{26EC}', // '⛬'
	'\u{26EB}', // '⛫'
	'\u{26ED}', // '⛭'
	'\u{26EE}', // '⛮'
	'\u{26F6}', // '⛶'
	'\u{26D8}', // '⛘'
	'\u{26D0}', // '⛐'
	'\u{26E9}', // '⛩'
	'\u{26E0}', // '⛠'
	'\u{26CB}', // '⛋'
	'\u{26DF}', // '⛟'
	'\u{26C9}', // '⛉'
	'\u{26CD}', // '⛍'
	'\u{26D7}', // '⛗'
	'\u{26DC}', // '⛜'
	'\u{26E1}', // '⛡'
	'\u{26CC}', // '⛌'
	'\u{26CF}', // '⛏'
];

/**
 * chunks of text which can be used to pad a message to bypass hypixel's spam filter
 */
const paddingChunks = [
	'----',
	'____',
	'////',
].map(chunk => `${invisibleCharacters[0]} ${chunk}`);

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

	randomPadding: () => paddingChunks[Math.floor(Math.random() * paddingChunks.length)],

	/**
	 * any non-'-' and non-whitespace
	 */
	defaultResponseRegExp: /[^-\s\u{2003}\u{2800}\u{0020}\u{180E}\u{200B}]/u,

	/**
	 * hypixel chat filter
	 */
	blockedWordsRegExp: /\b(?:cyber)?s[e3]x\b|seks|\bcum(?:shot)?\b|\bsemen\b|\br+a+p(?:e+d*|i+n+g+)\b|nutte(?:d|r)|\bj(?:er|ac)k +of|suck +me +off|\bb[o0]n[e3]r\b|schl[o0]ng|\borgy\b|\bth[o0]t\b|pus{2,}y|orgasm|\ba+n+a+l+\b|suck +my +dick|nude|\bp+ornhub+(?:\..+)?\b|\bxhamster(?:\..+)?\b|\bp[e3]do(?:phile|s)?\b|(?:you'?r+?e?|ur|(?:your|ur) +(?:m[uo]m|dad)|\bs?he +is) +gay+\b|ur gae|fa(g+o+|g{2,})t|f(?:4|@)g|cocain|\bh+e+r+o+i+n+\b|\bk+ys+\b|(?:kill.*|sho{2,}t+) +y *o *u *r *s *e *l *f+\b|kil{2,}m+y+ *s+elf|school *shoot|get +aids|autist|\bdownie\b|\bsuicide\b|\bslave\b|brain *dead|retarted|deranged|\bn+i(?:b{2,}|g{2,})(?:er+|a+)\b|\bnig+a*\b|\bch[aio]ng\b|\bco{2,}n+s*\b|\bhurri\b|\bk{3,}\b|kkr|hope +you +die|die +tmr|go +die +in +a +hole|\bcok\b|kanker/i,

	/**
	 * spam messages
	 */
	memeRegExp: /[⠁-⣿]|\be+z+\b/,

	nonWhiteSpaceRegExp: new RegExp(`[^\\s\u{2003}\u{2800}\u{0020}\u{180E}\u{200B}${invisibleCharacters.join('')}]`, 'u'),
};
