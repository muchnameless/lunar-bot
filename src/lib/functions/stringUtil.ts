import { jaroWinkler } from '@skyra/jaro-winkler';
import { cleanCodeBlockContent, codeBlock, escapeCodeBlock } from 'discord.js';
import { EmbedLimits } from '@sapphire/discord-utilities';
import ms from 'ms';
import { SMALL_LATIN_CAPITAL_LETTERS, AnsiFormat } from '#constants';
import type { AnsiBackground, AnsiColour } from '#constants';
import type { Merge } from '#types';

type AnsiOptions =
	| [AnsiFormat, AnsiBackground?, AnsiColour?]
	| [AnsiFormat, AnsiColour?]
	| [AnsiBackground, AnsiColour?]
	| [AnsiBackground]
	| [AnsiColour];

/**
 * ansi code block formatting and colouring tag
 * @param options format | background | colour
 */
// "? ||" to use the fallback for an empty options array
export const ansiTag = (options?: AnsiOptions) => `\u001B[${options?.join(';') || AnsiFormat.Normal}m` as const;

/**
 * wraps the content in ansi tags
 * @link https://gist.github.com/kkrypt0nn/a02506f3712ff2d1c8ca7c9e0aed7c06
 * @param content
 * @param options format | background | colour
 */
export const ansi = <T extends string | number>(content: T, ...options: AnsiOptions) =>
	`${ansiTag(options)}${content}${ansiTag()}` as const;

const orListFormatter = new Intl.ListFormat('en-GB', { style: 'short', type: 'disjunction' });

/**
 * ['a', 'b', 'c'] -> 'a, b or c'
 * @param list
 */
export const commaListOr = (list: string[]) => orListFormatter.format(list);

const andListFormatter = new Intl.ListFormat('en-GB', { style: 'short', type: 'conjunction' });

/**
 * ['a', 'b', 'c'] -> 'a, b and c'
 * @param list
 */
export const commaListAnd = (list: string[]) => andListFormatter.format(list);

/**
 * escapes discord markdown in igns
 * @param string to escape
 */
export const escapeIgn = (string: string | null) => string?.replaceAll('_', '\\_') ?? '';

/**
 * extracts user IDs from @mentions
 * @param string to analyze
 */
export const getIdFromString = (string: string) => /(?<=^(?:<@!?)?)\d{17,20}(?=>?$)/.exec(string)?.[0] ?? null;

/**
 * aBc -> Abc
 * @param string to convert
 */
export const upperCaseFirstChar = (string: string) => `${string[0]!.toUpperCase()}${string.slice(1).toLowerCase()}`;

/**
 * removes ',', '.' and '_' from the input string
 * @param string input
 */
export const removeNumberFormatting = (string: string | null) => string?.replace(/[,._]/g, '');

/**
 * trims a string to a certain length
 * @param string to trim
 * @param max maximum length
 */
export const trim = (string: string, max: number) => (string.length > max ? `${string.slice(0, max - 3)}...` : string);

/**
 * replaces toLocaleString('fr-FR') separator with a normal space
 * @param string
 */
export const cleanFormattedNumber = (string: string) => string.replaceAll('\u{202F}', ' ');

/**
 * replaces all small latin capital letters with normal lowercase letters
 * @param string
 */
export const replaceSmallLatinCapitalLetters = (string: string) =>
	Object.entries(SMALL_LATIN_CAPITAL_LETTERS).reduce((s, [normal, small]) => s.replaceAll(small, normal), string);

/**
 * '30d1193h71585m4295001s' -> 15_476_901_000
 * @param string
 */
export const stringToMS = (string: string) => string.split(/(?<=[a-z])(?=\d)/).reduce((acc, cur) => acc + ms(cur), 0);

/**
 * removes minecraft formatting codes
 * @param string
 */
export const removeMcFormatting = (string: string) => string.replace(/§[\da-gk-or]/g, '');

/**
 * escapes '*' and '_' if those are neither within a URL nor a code block or inline code
 * @param string
 * @param escapeEverything whether to also escape '\' before '*' and '_'
 */
export const escapeMarkdown = (string: string, escapeEverything = false) =>
	string
		.split('```')
		.map((subString, index, array) => {
			if (index % 2 && index !== array.length - 1) return subString;

			return string
				.split(/(?<=^|[^`])`(?=[^`]|$)/)
				.map((_subString, _index, _array) => {
					if (_index % 2 && _index !== _array.length - 1) return _subString;

					if (escapeEverything) {
						return _subString
							.replace(/(?=\*)/g, '\\') // escape italic 1/2
							.replace(/(\S*)_([^\s_]*)/g, (match, p1: string, p2: string) => {
								// escape italic 2/2 & underline
								if (/^https?:\/\/|^www\./i.test(match)) return match; // don't escape URLs
								if (p1.includes('<') || p2.includes('>')) return match; // don't escape emojis
								return `${p1.replace(/(?=_)/g, '\\')}\\_${p2}`; // escape not already escaped '_'
							});
					}

					return _subString
						.replace(/(?<!\\)(?=\*)/g, '\\') // escape italic 1/2
						.replace(/(\S*)_([^\s_]*)/g, (match, p1: string, p2: string) => {
							// escape italic 2/2 & underline
							if (/^https?:\/\/|^www\./i.test(match)) return match; // don't escape URLs
							if (p1.includes('<') || p2.includes('>')) return match; // don't escape emojis
							return `${p1.replace(/(?<!\\)(?=_)/g, '\\')}${p1.endsWith('\\') ? '' : '\\'}_${p2}`; // escape not already escaped '_'
						});
				})
				.join('`');
		})
		.join('```');

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

/**
 * compares to strings alphabetically, case insensitive
 * @param a
 * @param b
 */
export const compareAlphabetically = (a?: string | null, b?: string | null) => collator.compare(a!, b!);

/**
 * @param splitText
 * @param options Options controlling the behavior of the split
 */
function concatMessageChunks(
	splitText: string[],
	{ maxLength, char, append, prepend }: Merge<Required<SplitOptions>, { char: string }>,
) {
	const messages: string[] = [];

	let msg = '';

	for (const chunk of splitText) {
		if (msg && `${msg}${char}${chunk}${append}`.length > maxLength) {
			messages.push(`${msg}${append}`);
			msg = prepend;
		}

		msg += `${msg && msg !== prepend ? char : ''}${chunk}`;
	}

	messages.push(msg);

	return messages.filter(Boolean);
}

export interface SplitOptions {
	maxLength?: number;
	char?: string | string[];
	prepend?: string;
	append?: string;
}

/**
 * Splits a string into multiple chunks at a designated character that do not exceed a specific length.
 * @param text Content to split
 * @param options Options controlling the behavior of the split
 */
export function splitMessage(
	text: string,
	{ maxLength = 2_000, char = '\n', prepend = '', append = '' }: SplitOptions = {},
) {
	if (text.length <= maxLength) return [text];

	let splitText = [text];

	if (Array.isArray(char)) {
		while (char.length && splitText.some(({ length }) => length > maxLength)) {
			const currentChar = char.shift()!;

			splitText = splitText.flatMap((chunk) =>
				chunk.length > maxLength
					? concatMessageChunks(chunk.split(currentChar), { maxLength, char: currentChar, prepend, append })
					: chunk,
			);
		}

		if (splitText.some(({ length }) => length > maxLength)) throw new RangeError('[SPLIT MESSAGE]: SPLIT_MAX_LEN');

		return splitText;
	}

	splitText = text.split(char);

	if (splitText.some(({ length }) => length > maxLength)) throw new RangeError('[SPLIT MESSAGE]: SPLIT_MAX_LEN');

	return concatMessageChunks(splitText, { maxLength, char: typeof char === 'string' ? char : '', append, prepend });
}

export interface MakeContentOptions {
	split?: SplitOptions | boolean;
	code?: string | boolean;
}

/**
 * TEMPORARY replacement until discordjs/builders includes a message builder
 * @param text
 * @param options
 */
export function makeContent(text = '', options: MakeContentOptions = {}) {
	const isCode = typeof options.code !== 'undefined' && options.code !== false;
	const splitOptions =
		options.split === true
			? {}
			: typeof options.split !== 'undefined' && options.split !== false
			? { ...options.split }
			: undefined;

	let content = text;

	if (isCode) {
		const codeName = typeof options.code === 'string' ? options.code : '';

		content = codeBlock(codeName, cleanCodeBlockContent(content));

		if (splitOptions) {
			splitOptions.prepend = `${splitOptions.prepend ?? ''}\`\`\`${codeName}\n`;
			splitOptions.append = `\n\`\`\`${splitOptions.append ?? ''}`;
		}
	}

	return splitMessage(content, splitOptions);
}

/**
 * generates an array of code blocks
 * @param input
 * @param code
 * @param char
 * @param formatter
 */
export function splitForEmbedFields(
	input: string,
	code = '',
	char = '\n',
	formatter: (text: string) => string = escapeCodeBlock,
) {
	const formattedInput = formatter(input);

	// empty code blocks would display the language
	if (!formattedInput) return [codeBlock('\u200B')];

	return splitMessage(codeBlock(code, formattedInput), {
		maxLength: EmbedLimits.MaximumFieldValueLength,
		char: [char, ''],
		prepend: `\`\`\`${code}\n`,
		append: '\n```',
	});
}

/**
 * calculate how many lines the single-line string takes up inside the embed field
 * @param string
 * @param lineLength
 */
function getDisplayedLines(string: string, lineLength: number) {
	let currentLine = '';
	let totalLines = 1;
	for (const word of string.split(' ')) {
		// word still fits within the same line
		if (currentLine.length + 1 + word.length <= lineLength) {
			currentLine += ` ${word}`;
		} else {
			++totalLines;
			currentLine = word;
		}
	}
	return totalLines;
}
/**
 * calculates how many lines the multi-line string takes up inside the embed field
 * @param string
 * @param lineLength
 */
export const getInlineFieldLineCount = (string: string, lineLength: number) =>
	string.length ? string.split('\n').reduce((acc, line) => acc + getDisplayedLines(line, lineLength), 0) : 0;

/**
 * jaro winkler similarity, 0 (no match) to 1 (exact match)
 * @param string1
 * @param string2
 * @returns
 */
export function jaroWinklerSimilarity(string1: string, string2: string) {
	const _string1 = string1.toLowerCase();
	const _string2 = string2.toLowerCase();

	if (_string1 === _string2) return 1;

	return jaroWinkler(_string1, _string2);
}
