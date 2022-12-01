/**
 * bot events that should only be listened to once
 */
export const SPAWN_EVENTS = new Set(['login'] as const satisfies readonly string[]);

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
	Guild = 'gc ',
	Officer = 'oc ',
	Party = 'pc ',
	Whisper = 'w ',
}

export const PREFIX_BY_TYPE = {
	[HypixelMessageType.Guild]: ChatPrefix.Guild,
	[HypixelMessageType.Officer]: ChatPrefix.Officer,
	[HypixelMessageType.Party]: ChatPrefix.Party,
	[HypixelMessageType.Whisper]: ChatPrefix.Whisper,
} as const satisfies Record<HypixelMessageType, ChatPrefix>;

export const CHAT_METHOD_BY_TYPE = {
	[HypixelMessageType.Guild]: 'gchat',
	[HypixelMessageType.Officer]: 'ochat',
	[HypixelMessageType.Party]: 'pchat',
	[HypixelMessageType.Whisper]: 'whisper',
} as const satisfies Record<HypixelMessageType, string>;

/**
 * characters that don't render in mc chat and ZWS
 */
export const INVISIBLE_CHARACTER_REGEXP = /ࠀ|⭍|֏|'꣰|⛬|⛫|⛭|⛮|⛶|⛘|⛐|⛠|⛋|⛟|⛉|⛍|⛗|⛜|⛡|⛌|\u{180E}|\u{200B}/gu;

export const DISCORD_APPLICATION_COMMAND_MENTION_REGEXP = /<(\/[\w-]{1,32}(?: [\w-]{1,32}){0,2}):\d{17,20}>/g;

export const DISCORD_CHANNEL_ROLE_MENTION_REGEXP = /<(#|@&)(\d{17,20})>/g;

export const DISCORD_CUSTOM_EMOJI_REGEXP = /<a?:(\w{2,32}):\d{17,20}>/g;

export const DISCORD_TIMESTAMP_REGEXP = /<t:(-?\d{1,13})(?::([DFRTdft]))?>/g;

export const DISCORD_USER_MENTION_REGEXP = /<@!?(\d{17,20})>/g;

export const EMOJI_NAME_REGEXP = /:(\S+?):/g;

export const ESCAPING_BACKSLASH_REGEXP = /(?<![\\¯])\\(?=[^\d\n \\a-z])/gi;

export const HIDE_LINK_EMBED_REGEXP = /<(https?:\/\/(?:www\.)?(?:[\da-z][\da-z-]+[\da-z]|[\da-z]+)\.\S{2,})>/gi;

export const MAYBE_URL_REGEXP = /(?:[\w-]+\.)+[a-z]{2}\S*/gi;

export const MINECRAFT_CHANNEL_MENTION_REGEXP = /#(\S+)/g;

export const MINECRAFT_EMOJI_REGEXP = /(?<!<[at]?):(\S+):(?!\d{17,20}>)/g;

export const MINECRAFT_MENTION_REGEXP = /(?<!<)@(?<type>!|&)?(?<name>\w+)(?!\d{17,20}>)/g;

export const MINECRAFT_SLASH_COMMAND_REGEXP = /\/([\w-]{1,32})(?: ([\w-]{1,32}))?(?: ([\w-]{1,32}))?/g;

export const MINECRAFT_TIMESTAMP_REGEXP = /(\bin )?(\ban?|\d+) ([a-z]+)( ago\b)?/gi;

export const MULTIPLE_BACKSLASH_REGEXP = /\\{2,}/g;

export const QUOTE_REGEXP = /(?<=^\s*)(?=>)/;

export const URL_REGEXP = /https?:\/\/(?:www\.)?(?:[\da-z][\da-z-]+[\da-z]|[\da-z]+)\.\S{2,}/gi;

/**
 * chunks of text which can be used to pad a message to bypass hypixel's spam filter
 */
export const PADDING_CHUNKS = ['-', '_', '/'].map((chunk) => ` ${chunk.repeat(4)}` as const);

export const randomPadding = () => PADDING_CHUNKS[Math.trunc(Math.random() * PADDING_CHUNKS.length)]!;

export const WHITESPACE_ONLY_REGEXP = /^[\s\u{2800}]*$/u;

export const DELETED_MESSAGE_REASON = Symbol('ChatBridge:deletedMessage');
