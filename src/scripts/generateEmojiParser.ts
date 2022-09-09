import { writeFile } from 'node:fs/promises';
import { Collection } from 'discord.js';
import { fetch } from 'undici';

/**
 * @link https://emzi0767.gl-pages.emzi0767.dev/discord-emoji/');
 * @link https://gitlab.emzi0767.dev/Emzi0767/discord-emoji');
 * @link https://emzi0767.gl-pages.emzi0767.dev/discord-emoji/discordEmojiMap.json');
 * @link https://emzi0767.gl-pages.emzi0767.dev/discord-emoji/discordEmojiMap-canary.json');
 * @link https://emzi0767.gl-pages.emzi0767.dev/discord-emoji/discordEmojiMap.min.json');
 * @link https://emzi0767.gl-pages.emzi0767.dev/discord-emoji/discordEmojiMap-canary.min.json');
 */
const url = 'https://emzi0767.gl-pages.emzi0767.dev/discord-emoji/discordEmojiMap-canary.min.json';

/**
 * emojis which can be displayed in 1.8.9 minecraft chat
 */
const skippedEmojis = new Set([
	'airplane',
	'alembic',
	'anchor',
	'aquarius',
	'aries',
	'arrow_backward',
	'arrow_down',
	'arrow_forward',
	'arrow_heading_down',
	'arrow_heading_up',
	'arrow_left',
	'arrow_lower_left',
	'arrow_lower_right',
	'arrow_right',
	'arrow_right_hook',
	'arrow_up',
	'arrow_up_down',
	'arrow_upper_left',
	'arrow_upper_right',
	'asterisk',
	'atom',
	'ballot_box_with_check',
	'bangbang',
	'biohazard',
	'black_circle',
	'black_large_square',
	'black_medium_small_square',
	'black_medium_square',
	'black_nib',
	'black_small_square',
	'cancer',
	'capricorn',
	'chess_pawn',
	'clubs',
	'coffee',
	'coffin',
	'comet',
	'congratulations',
	'copyright',
	'cross',
	'crossed_swords',
	'diamonds',
	'eight',
	'eight_pointed_black_star',
	'eight_spoked_asterisk',
	'eject',
	'envelope',
	'female_sign',
	'five',
	'fleur_de_lis',
	'four',
	'frowning2',
	'gear',
	'gemini',
	'hammer_pick',
	'hash',
	'heart',
	'heart_exclamation',
	'hearts',
	'heavy_check_mark',
	'heavy_multiplication_x',
	'hotsprings',
	'hourglass',
	'infinity',
	'information_source',
	'interrobang',
	'keyboard',
	'left_right_arrow',
	'leftwards_arrow_with_hook',
	'leo',
	'libra',
	'm',
	'male_sign',
	'medical_symbol',
	'nine',
	'one',
	'orthodox_cross',
	'part_alternation_mark',
	'peace',
	'pencil2',
	'pisces',
	'point_up',
	'point_up_tone1',
	'point_up_tone2',
	'point_up_tone3',
	'point_up_tone4',
	'point_up_tone5',
	'radioactive',
	'recycle',
	'regional_indicator_a',
	'regional_indicator_b',
	'regional_indicator_c',
	'regional_indicator_d',
	'regional_indicator_e',
	'regional_indicator_f',
	'regional_indicator_g',
	'regional_indicator_h',
	'regional_indicator_i',
	'regional_indicator_j',
	'regional_indicator_k',
	'regional_indicator_l',
	'regional_indicator_m',
	'regional_indicator_n',
	'regional_indicator_o',
	'regional_indicator_p',
	'regional_indicator_q',
	'regional_indicator_r',
	'regional_indicator_s',
	'regional_indicator_t',
	'regional_indicator_u',
	'regional_indicator_v',
	'regional_indicator_w',
	'regional_indicator_x',
	'regional_indicator_y',
	'regional_indicator_z',
	'registered',
	'relaxed',
	'sagittarius',
	'scales',
	'scissors',
	'scorpius',
	'secret',
	'seven',
	'shamrock',
	'six',
	'skull_crossbones',
	'snowflake',
	'snowman2',
	'spades',
	'sparkle',
	'star',
	'star_and_crescent',
	'star_of_david',
	'sunny',
	'taurus',
	'telephone',
	'three',
	'tm',
	'two',
	'umbrella2',
	'umbrella',
	'urn',
	'v',
	'v_tone1',
	'v_tone2',
	'v_tone3',
	'v_tone4',
	'v_tone5',
	'virgo',
	'warning',
	'watch',
	'wavy_dash',
	'wheel_of_dharma',
	'wheelchair',
	'white_check_mark',
	'white_circle',
	'white_large_square',
	'white_medium_small_square',
	'white_medium_square',
	'white_small_square',
	'writing_hand',
	'writing_hand_tone1',
	'writing_hand_tone2',
	'writing_hand_tone3',
	'writing_hand_tone4',
	'writing_hand_tone5',
	'x',
	'yin_yang',
	'zap',
	'zero',
]);

export interface EmojiResponse {
	assetHash: string;
	bundleType: string;
	discordClient: string;
	donate: string[];
	emojiDefinitions: {
		assetFileName: string;
		assetUrl: string;
		category: string;
		names: string[];
		namesWithColons: string[];
		primaryName: string;
		primaryNameWithColons: string;
		surrogates: string;
		utf32codepoints: number[];
	}[];
	sources: string[];
	version: `${bigint}`;
	versionTimestamp: string;
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

const compareAlphabetically = (a?: string | null, b?: string | null) => collator.compare(a!, b!);

const sanitizeName = (name: string) => name.replace(/(?=['\\])/g, '\\');

const data = ((await (await fetch(url)).json()) as EmojiResponse).emojiDefinitions.sort(
	({ primaryName: a }, { primaryName: b }) => compareAlphabetically(a, b),
);

const lines: string[] = [];

// header
lines.push('/**');
lines.push(' * @link https://emzi0767.gl-pages.emzi0767.dev/discord-emoji/');
lines.push(' * @link https://gitlab.emzi0767.dev/Emzi0767/discord-emoji');
lines.push(' * @link https://emzi0767.gl-pages.emzi0767.dev/discord-emoji/discordEmojiMap.json');
lines.push(' * @link https://emzi0767.gl-pages.emzi0767.dev/discord-emoji/discordEmojiMap-canary.json');
lines.push(' * @link https://emzi0767.gl-pages.emzi0767.dev/discord-emoji/discordEmojiMap.min.json');
lines.push(' * @link https://emzi0767.gl-pages.emzi0767.dev/discord-emoji/discordEmojiMap-canary.min.json');
lines.push(' */');
lines.push('');

// EMOJI_NAME_TO_UNICODE
lines.push('/* eslint-disable id-length */'); // some keys are single chars
lines.push('');
lines.push('/**');
lines.push(' * discord emoji names to unicode emojis');
lines.push(' */');
lines.push('export const EMOJI_NAME_TO_UNICODE = {');

const unique = new Collection<string, string>();

for (const { namesWithColons, surrogates } of data) {
	for (const name of namesWithColons) {
		// namesWithColons includes stuff like :-) too which should not be parsed
		if (!name.startsWith(':') || !name.endsWith(':')) continue;

		// "_", "-" and ":" are removed because the parser removes them too. can't use names since have to check if :: is present to filter out certain names above
		unique.set(sanitizeName(name).replace(/(?<!:)[_-]+|:+/g, ''), surrogates);
	}
}

for (const [name, surrogates] of unique.sort((_0, _1, a, b) => compareAlphabetically(a, b)).entries()) {
	lines.push(`\t'${name}': '${surrogates}',`);
}

// UNICODE_TO_EMOJI_NAME
lines.push('} as const;');
lines.push('');

lines.push('/**');
lines.push(' * unicode emojis to discord emoji names');
lines.push(' */');
lines.push('export const UNICODE_TO_EMOJI_NAME = {');

for (const { primaryName, primaryNameWithColons, surrogates } of data) {
	const name = skippedEmojis.has(primaryName)
		? primaryName.startsWith('regional_indicator_')
			? // regional_indicator_a -> A
			  primaryName.at(-1)!.toUpperCase()
			: // replace with first unicode character
			  [...surrogates][0]!
		: primaryNameWithColons;

	lines.push(`\t'${surrogates}': '${sanitizeName(name)}',`);
}

lines.push('} as const;');
lines.push('');

await writeFile('src/lib/chatBridge/constants/emojiNameUnicodeConverter.ts', lines.join('\n'));
