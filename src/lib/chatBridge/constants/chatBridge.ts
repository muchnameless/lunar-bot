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

export const CHAT_METHOD_BY_TYPE = {
	[HypixelMessageType.Guild]: 'gchat',
	[HypixelMessageType.Officer]: 'ochat',
	[HypixelMessageType.Party]: 'pchat',
	[HypixelMessageType.Whisper]: 'whisper',
} as const;

/**
 * characters that don't render in mc chat and ZWS
 */
export const INVISIBLE_CHARACTER_REGEXP = /ࠀ|⭍|֏|'꣰|⛬|⛫|⛭|⛮|⛶|⛘|⛐|⛠|⛋|⛟|⛉|⛍|⛗|⛜|⛡|⛌|\u{180E}|\u{200B}/gu;

/**
 * chunks of text which can be used to pad a message to bypass hypixel's spam filter
 */
export const PADDING_CHUNKS = ['-', '_', '/'].map((chunk) => ` ${chunk.repeat(4)}` as const);

export const randomPadding = () => PADDING_CHUNKS[Math.trunc(Math.random() * PADDING_CHUNKS.length)]!;

export const WHITESPACE_ONLY_REGEXP = /^[\s\u{2800}]*$/u;

export const DELETED_MESSAGE_REASON = Symbol('ChatBridge:deletedMessage');
