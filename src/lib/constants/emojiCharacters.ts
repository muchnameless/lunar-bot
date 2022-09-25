/* eslint-disable typescript-sort-keys/string-enum */
export const enum UnicodeEmoji {
	// basic
	X = '❌',
	Y = '✅',
	VarY = '✔️',

	// pagination
	DoubleLeft = '⏮️',
	DoubleRight = '⏭️',
	Left = '◀️',
	Reload = '🔄',
	Right = '▶️',

	// chat bridge
	Broadcast = '📣',
	Muted = '🔇',
	NoPing = '🔕',
	Stop = '🛑',

	// commands
	Delete = '🗑️',
	EditMessage = '⌨️',
	Eyes = '👀',
	Pin = '📌',
}
/* eslint-enable typescript-sort-keys/string-enum */

/**
 * SkyBlock profile cute_name emojis
 */
export const PROFILE_EMOJIS = {
	Apple: '🍎',
	Banana: '🍌',
	Blueberry: '🔵',
	Coconut: '🥥',
	Cucumber: '🥒',
	Grapes: '🍇',
	Kiwi: '🥝',
	Lemon: '🍋',
	Lime: '🍏',
	Mango: '🥭',
	Orange: '🍊',
	Papaya: '🍈',
	Peach: '🍑',
	Pear: '🍐',
	Pineapple: '🍍',
	Pomegranate: '👛',
	Raspberry: '🍒',
	Strawberry: '🍓',
	Tomato: '🍅',
	Watermelon: '🍉',
	Zucchini: '🥬',
} as const;

/**
 * SkyBlock profile game_mode emojis
 */
export const GAME_MODE_EMOJIS = {
	bingo: 'Ⓑ',
	ironman: '♲',
} as const;
