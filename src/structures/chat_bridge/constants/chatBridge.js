/**
 * bot events that should only be listened to once
 */
export const spawnEvents = Object.freeze([
	'login',
	'keep_alive',
]);

export const messageTypes = Object.freeze({
	WHISPER: 'whisper',
	GUILD: 'guild',
	OFFICER: 'officer',
	PARTY: 'party',
});

export const prefixByType = Object.freeze({
	guild: '/gc',
	officer: '/oc',
	party: '/pc',
});

export const chatFunctionByType = Object.freeze({
	guild: 'gchat',
	officer: 'ochat',
	party: 'pchat',
});

/**
 * characters that don't render in mc chat
 */
export const invisibleCharacters = Object.freeze([
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
]);

export const randomInvisibleCharacter = () => invisibleCharacters[Math.floor(Math.random() * invisibleCharacters.length)];

export const invisibleCharacterRegExp = new RegExp(invisibleCharacters.join('|'), 'gu');

/**
 * chunks of text which can be used to pad a message to bypass hypixel's spam filter
 */
const paddingChunks = [
	'----',
	'____',
	'////',
].map(chunk => `${invisibleCharacters[0]} ${chunk}`);

export const randomPadding = () => paddingChunks[Math.floor(Math.random() * paddingChunks.length)];

/**
 * any non-'-' and non-whitespace
 */
export const defaultResponseRegExp = /[^-\s\u{2003}\u{2800}\u{0020}\u{180E}\u{200B}]/u;

/**
 * spam messages
 */
export const memeRegExp = /[⠁-⣿]|\be+z+\b/;

export const nonWhiteSpaceRegExp = new RegExp(`[^\\s\u{2003}\u{2800}\u{0020}\u{180E}\u{200B}${invisibleCharacters.join('')}]`, 'u');

/**
 * https://cdn.discordapp.com/attachments/724130826165420052/876441229905256448/card.png
 * https://media.discordapp.net/attachments/795861078415638539/876641628083867688/unknown.png
 */
// eslint-disable-next-line no-empty-character-class
export const urlRegExp = /\b(?:https:\/\/)?(?:media|cdn)\.discord(?:app)?\.(?:net|com)\/attachments\/\d{17,19}\/\d{17,19}\/[^.]+\.(?:png|jpg|jpeg)(?:\?width=\d+&height=\d+)?\b/gd;
