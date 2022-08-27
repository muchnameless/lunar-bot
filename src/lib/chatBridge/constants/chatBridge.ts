/**
 * bot events that should only be listened to once
 */
export const SPAWN_EVENTS = new Set(['login', 'keep_alive'] as const);

/**
 * https://wiki.vg/Protocol -> Player Chat Message -> Type
 */
export enum MessagePosition {
	Chat,
	System,
	GameInfo,
	SayCommand,
	MsgCommandd,
	TeamMsgCommandd,
	Emote,
	Tellraw,
}

export const enum HypixelMessageType {
	Whisper = 'WHISPER',
	Guild = 'GUILD',
	Officer = 'OFFICER',
	Party = 'PARTY',
}

export const enum MinecraftChatManagerState {
	Ready,
	Connecting,
	Errored,
}

export const PREFIX_BY_TYPE = {
	GUILD: '/gc',
	OFFICER: '/oc',
	PARTY: '/pc',
} as const;

export const CHAT_FUNCTION_BY_TYPE = {
	GUILD: 'gchat',
	OFFICER: 'ochat',
	PARTY: 'pchat',
} as const;

/**
 * characters that don't render in mc chat
 */
export const INVISIBLE_CHARACTERS = [
	'\u{800}', // 'ࠀ'
	'\u{2B4D}', // '⭍'
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
] as const;

export const INVISIBLE_CHARACTER_REGEXP = new RegExp(INVISIBLE_CHARACTERS.join('|'), 'gu');

/**
 * chunks of text which can be used to pad a message to bypass hypixel's spam filter
 */
const PADDING_CHUNKS = ['-', '_', '/'].map((chunk) => ` ${chunk.repeat(4)}` as const);

export const randomPadding = () => PADDING_CHUNKS[Math.trunc(Math.random() * PADDING_CHUNKS.length)]!;

/**
 * any non-'-' and non-whitespace
 */
export const DEFAULT_RESPONSE_REGEXP = /[^-\s\u{2800}\u{180E}\u{200B}]/u;

/**
 * spam messages
 */
// eslint-disable-next-line regexp/no-obscure-range
export const MEME_REGEXP = /[⠁-⣿]|\be+z+\b/;

export const NON_WHITESPACE_REGEXP = new RegExp(
	`[^\\s\u{2003}\u{2800}\u{0020}\u{180E}\u{200B}${INVISIBLE_CHARACTERS.join('')}]`,
	'u',
);

/**
 * https://cdn.discordapp.com/attachments/724130826165420052/876441229905256448/card.png
 * https://media.discordapp.net/attachments/795861078415638539/876641628083867688/unknown.png?height=50&width=20
 * https://cdn.discordapp.com/emojis/830971380283605042.png?size=96
 */
export const DISCORD_CDN_URL_REGEXP =
	/\b((?:https:\/\/)?(?:cdn|media)\.discord(?:app)?\.(?:com|net)\/(?:attachments\/\d{17,20}\/\d{17,20}\/.+|emojis\/\d{17,20})\.(?:jpeg|jpg|png))(?:\?\w+=\w+(?:&\w+=\w+)*)?\b/g;

/**
 * only lower case versions are not blocked by the advertisement filter
 */
export const ALLOWED_URLS = new RegExp(
	['hypixel.net', 'discord.gg', 'imgur.com'].map((x) => `\\b${x}(?:$|\\/)`).join('|'),
);

export const DELETED_MESSAGE_REASON = Symbol('ChatBridge:deletedMessage');
