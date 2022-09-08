import { writeFile } from 'node:fs/promises';
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
	({ primaryNameWithColons: a }, { primaryNameWithColons: b }) => compareAlphabetically(a, b),
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
lines.push(' *');
lines.push(' * commented emojis are rendered in mc chat -> no need to transform');
lines.push(' */');
lines.push('');

// EMOJI_NAME_TO_UNICODE
lines.push('/**');
lines.push(' * discord emoji names to unicode emojis');
lines.push(' */');
lines.push('export const EMOJI_NAME_TO_UNICODE = {');

const unique = new Map<string, string>();
for (const { namesWithColons, surrogates } of data) {
	for (const name of namesWithColons) {
		// namesWithColons includes stuff like :-) too which should not be parsed
		if (!name.startsWith(':') || !name.endsWith(':')) continue;

		// "_" and "-" are removed because the parser removes them too
		unique.set(sanitizeName(name).replace(/(?<!:)[_-]+/g, ''), surrogates);
	}
}

for (const [namesWithColons, surrogates] of unique.entries()) {
	lines.push(`\t'${namesWithColons}': '${surrogates}',`);
}

// UNICODE_TO_EMOJI_NAME
lines.push('} as const;');
lines.push('');

lines.push('/**');
lines.push(' * unicode emojis to discord emoji names');
lines.push(' */');
lines.push('export const UNICODE_TO_EMOJI_NAME = {');

for (const { primaryNameWithColons, surrogates } of data) {
	lines.push(`\t'${surrogates}': '${sanitizeName(primaryNameWithColons)}',`);
}

lines.push('} as const;');
lines.push('');

await writeFile('src/lib/chatBridge/constants/emojiNameUnicodeConverter.ts', lines.join('\n'));
