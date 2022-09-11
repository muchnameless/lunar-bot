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
	Guild = 'GUILD',
	Officer = 'OFFICER',
	Party = 'PARTY',
	Whisper = 'WHISPER',
}

export const enum ChatPrefix {
	Guild = '/gc ',
	Officer = '/oc ',
	Party = '/pc ',
	Whisper = '/w ',
}

export const PREFIX_BY_TYPE = {
	[HypixelMessageType.Guild]: ChatPrefix.Guild,
	[HypixelMessageType.Officer]: ChatPrefix.Officer,
	[HypixelMessageType.Party]: ChatPrefix.Party,
	[HypixelMessageType.Whisper]: ChatPrefix.Whisper,
} as const;

/**
 * characters that don't render in mc chat
 */
export const INVISIBLE_CHARACTER_REGEXP = /ࠀ|⭍|֏|'꣰|⛬|⛫|⛭|⛮|⛶|⛘|⛐|⛠|⛋|⛟|⛉|⛍|⛗|⛜|⛡|⛌/gu;

/**
 * chunks of text which can be used to pad a message to bypass hypixel's spam filter
 */
export const PADDING_CHUNKS = ['-', '_', '/'].map((chunk) => ` ${chunk.repeat(4)}` as const);

export const randomPadding = () => PADDING_CHUNKS[Math.trunc(Math.random() * PADDING_CHUNKS.length)]!;

/**
 * any non-'-' and non-whitespace
 */
export const DEFAULT_RESPONSE_REGEXP = /[^-\s\u{2800}\u{180E}\u{200B}]/u;

export const WHITESPACE_ONLY_REGEXP = /^[\s\u{2003}\u{2800}\u{0020}\u{180E}\u{200B}]*$/u;

export const DELETED_MESSAGE_REASON = Symbol('ChatBridge:deletedMessage');
