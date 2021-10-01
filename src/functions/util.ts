import { Formatters, Util } from 'discord.js';
import { fileURLToPath } from 'node:url';
import ms from 'ms';
import jaroWinklerSimilarity from 'jaro-winkler';
import readdirp from 'readdirp';
import { EMBED_FIELD_MAX_CHARS } from '../constants';
import { logger } from '.';
import type { SplitOptions } from 'discord.js';
import type { URL } from 'node:url';


/**
 * lets you insert any string as the plain string into a regex
 * @param string to escape
 */
export const escapeRegex = (string: string) => string.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');

/**
 * escapes discord markdown in igns
 * @param string to escape
 */
export const escapeIgn = (string: string | null) => string?.replace(/_/g, '\\_') ?? '';

/**
 * extracts user IDs from @mentions
 * @param string to analyze
 */
export const getIdFromString = (string: string) => string.match(/(?<=^(?:<@!?)?)\d{17,19}(?=>?$)/)?.[0] ?? null;

/**
 * aBc -> Abc
 * @param string to convert
 */
export const upperCaseFirstChar = (string: string) => `${string[0].toUpperCase()}${string.slice(1).toLowerCase()}`;

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
export const cleanFormattedNumber = (string: string) => string.replace(/\u{202F}/ug, ' ');

/**
 * '30d1193h71585m4295001s' -> 15_476_901_000
 * @param string
 */
export const stringToMS = (string: string) => string.split(/(?<=[a-z])(?=\d)/).reduce((acc, cur) => acc + ms(cur), 0);

/**
 * returns the ISO week number of the given date
 * @param date date to analyze
 */
export function getWeekOfYear(date: Date) {
	const target = new Date(date.valueOf());
	const dayNumber = (date.getUTCDay() + 6) % 7;

	target.setUTCDate(target.getUTCDate() - dayNumber + 3);

	const firstThursday = target.valueOf();

	target.setUTCMonth(0, 1);

	if (target.getUTCDay() !== 4) {
		target.setUTCMonth(0, 1 + (((4 - target.getUTCDay()) + 7) % 7));
	}

	return Math.ceil((firstThursday - target.getTime()) / (7 * 24 * 3_600_000)) + 1;
}

/**
 * checks the query agains the validInput and returns the most likely match
 * @param query
 * @param validInput
 * @param attributeToQuery
 */
export function autocorrect<T>(query: string, validInput: readonly T[] | Map<unknown, T> | IterableIterator<T>, attributeToQuery?: keyof T) {
	let currentBestElement!: T;
	let currentBestSimilarity = 0;

	// @ts-expect-error values does not exist on IterableIterator
	for (const element of (validInput.values?.() ?? validInput) as T[]) {
		const similarity = jaroWinklerSimilarity(query, (attributeToQuery ? element[attributeToQuery] : element) as unknown as string, { caseSensitive: false });

		if (similarity === 1) return {
			value: element,
			similarity,
		};

		if (similarity < currentBestSimilarity) continue;

		currentBestElement = element;
		currentBestSimilarity = similarity;
	}

	logger.info(`[AUTOCORRECT]: autocorrected '${query}' to '${attributeToQuery ? currentBestElement[attributeToQuery] : currentBestElement}' with a certainty of ${currentBestSimilarity}`);

	return {
		value: currentBestElement,
		similarity: currentBestSimilarity,
	};
}

/**
 * <Array>.filter with an asynchronous callback function
 * @param arr
 * @param callback
 */
export async function asyncFilter<T>(arr: T[], callback: (x: T) => boolean | Promise<boolean>): Promise<T[]> {
	const fail = Symbol();
	return (await Promise.all(arr.map(async item => ((await callback(item)) ? item : fail)))).filter(i => i !== fail) as T[];
}

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
function concatMessageChunks(splitText: string[], { maxLength, char, append, prepend }: { maxLength: number, char: string, prepend: string, append: string }) {
	const messages = [];

	let msg = '';

	for (const chunk of splitText) {
		if (msg && `${msg}${char}${chunk}${append}`.length > maxLength) {
			messages.push(`${msg}${append}`);
			msg = prepend;
		}

		msg += (msg && msg !== prepend ? char : '') + chunk;
	}

	return messages.concat(msg).filter(m => m);
}

/**
 * Splits a string into multiple chunks at a designated character that do not exceed a specific length.
 * @param text Content to split
 * @param options Options controlling the behavior of the split
 */
export function splitMessage(text: string, { maxLength = 2_000, char = '\n', prepend = '', append = '' }: SplitOptions = {}) {
	if (text.length <= maxLength) return [ text ];

	let splitText = [ text ];

	if (Array.isArray(char)) {
		while (char.length && splitText.some(({ length }) => length > maxLength)) {
			const currentChar = char.shift();

			if (currentChar instanceof RegExp) {
				splitText = splitText.flatMap((chunk) => {
					if (chunk.length <= maxLength) return chunk;

					if (currentChar.global) {
						const matched = chunk.match(currentChar);

						if (!matched) return chunk;

						return matched.map(match => concatMessageChunks(chunk.split(match), { maxLength, char: match, prepend, append }));
					}

					// no global flag
					const matched = chunk.match(currentChar)?.[0];

					if (!matched) return chunk;

					return concatMessageChunks(chunk.split(matched), { maxLength, char: matched, prepend, append });
				});
			} else {
				splitText = splitText.flatMap(chunk => (chunk.length > maxLength ? concatMessageChunks(chunk.split(currentChar), { maxLength, char: currentChar, prepend, append }) : chunk));
			}
		}

		if (splitText.some(({ length }) => length > maxLength)) throw new RangeError('SPLIT_MAX_LEN');

		return splitText;
	}

	splitText = text.split(char);

	if (splitText.some(({ length }) => length > maxLength)) throw new RangeError('SPLIT_MAX_LEN');

	return concatMessageChunks(splitText, { maxLength, char, append, prepend });
}

/**
 * TEMPORARY replacement until discordjs/builders includes a message builder
 * @param text
 * @param options
 */
export function makeContent(text = '', options: { split?: boolean | string, code?: string | boolean } = {}) {
	const isCode = typeof options.code !== 'undefined' && options.code !== false;
	const splitOptions = typeof options.split !== 'undefined' && options.split !== false
		? { ...options.split as unknown as Record<string, unknown> }
		: undefined;

	let content = text;

	if (isCode) {
		const codeName = typeof options.code === 'string'
			? options.code
			: '';

		content = Formatters.codeBlock(codeName, Util.cleanCodeBlockContent(content));

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
export function splitForEmbedFields(input: string, code = '', char = '\n', formatter: (text: string) => string = Util.escapeCodeBlock) {
	return splitMessage(
		Formatters.codeBlock(code, formatter(input)),
		{ maxLength: EMBED_FIELD_MAX_CHARS, char: [ char, '' ], prepend: `\`\`\`${code}\n`, append: '```' },
	);
}

/**
 * waits for all promises to settle and logs the errored ones
 * @param arr
 */
export async function safePromiseAll(arr: (unknown | Promise<unknown>)[]) {
	for (const x of await Promise.allSettled(arr)) {
		if (x.status === 'rejected') logger.error(x.reason);
	}
}

/**
 * removes minecraft formatting codes
 * @param string
 */
export const removeMcFormatting = (string: string) => string.replace(/§[\da-gk-or]/g, '');


/**
 * creates a 'await for..of'-consumable ReaddirpStream from all .js files that don't start with a '~'
 * @param root
 */
export const readJSFiles = (root: string | URL) => readdirp(fileURLToPath(root), { fileFilter: [ '*.js', '!~*' ] });
