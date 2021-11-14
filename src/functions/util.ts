import { Formatters, Util } from 'discord.js';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import ms from 'ms';
import jaroWinklerSimilarity from 'jaro-winkler';
import readdirp from 'readdirp';
import { EMBED_FIELD_MAX_CHARS, MAX_CHOICES } from '../constants';
import { days, logger } from '.';
import type { URL } from 'node:url';
import type { Collection } from 'discord.js';
import type { Merge } from '../types/util';

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
export const cleanFormattedNumber = (string: string) => string.replace(/\u{202F}/gu, ' ');

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
	const target = new Date(date.getTime());
	const dayNumber = (date.getUTCDay() + 6) % 7;

	target.setUTCDate(target.getUTCDate() - dayNumber + 3);

	const firstThursday = target.getTime();

	target.setUTCMonth(0, 1);

	if (target.getUTCDay() !== 4) {
		target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
	}

	return Math.ceil((firstThursday - target.getTime()) / days(7)) + 1;
}

/**
 * checks the query agains the validInput and returns the most likely match
 * @param query
 * @param validInput
 * @param attributeToQuery
 */
export function autocorrect<T>(
	query: string,
	validInput: readonly T[] | Map<unknown, T> | IterableIterator<T>,
	attributeToQuery?: keyof T,
) {
	let currentBestElement!: T;
	let currentBestSimilarity = 0;

	for (const element of (validInput as Map<unknown, T>).values?.() ?? validInput) {
		const similarity = jaroWinklerSimilarity(
			query,
			(attributeToQuery ? element[attributeToQuery] : element) as unknown as string,
			{ caseSensitive: false },
		);

		if (similarity === 1) {
			return {
				value: element,
				similarity,
			};
		}

		if (similarity < currentBestSimilarity) continue;

		currentBestElement = element;
		currentBestSimilarity = similarity;
	}

	logger.info(
		`[AUTOCORRECT]: autocorrected '${query}' to '${
			attributeToQuery ? currentBestElement[attributeToQuery] : currentBestElement
		}' with a certainty of ${currentBestSimilarity}`,
	);

	return {
		value: currentBestElement,
		similarity: currentBestSimilarity,
	};
}

/**
 * <Array>.filter with an asynchronous callback function
 * @param array
 * @param predicate
 */
export async function asyncFilter<T>(
	array: T[],
	predicate: (value: T, index: number, array: T[]) => boolean | Promise<boolean>,
): Promise<T[]> {
	const fail = Symbol();

	return (
		await Promise.all(array.map(async (item, index) => ((await predicate(item, index, array)) ? item : fail)))
	).filter((x) => x !== fail) as T[];
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

	return [...messages, msg].filter(Boolean);
}

export interface SplitOptions {
	maxLength?: number;
	char?: string | RegExp | (string | RegExp)[];
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

			splitText =
				currentChar instanceof RegExp
					? splitText.flatMap((chunk) => {
							if (chunk.length <= maxLength) return chunk;

							if (currentChar.global) {
								const matched = chunk.match(currentChar);

								if (!matched) return chunk;

								return matched.flatMap((match) =>
									concatMessageChunks(chunk.split(match), { maxLength, char: match, prepend, append }),
								);
							}

							// no global flag
							const matched = chunk.match(currentChar)?.[0];

							if (!matched) return chunk;

							return concatMessageChunks(chunk.split(matched), { maxLength, char: matched, prepend, append });
					  })
					: splitText.flatMap((chunk) =>
							chunk.length > maxLength
								? concatMessageChunks(chunk.split(currentChar), { maxLength, char: currentChar, prepend, append })
								: chunk,
					  );
		}

		if (splitText.some(({ length }) => length > maxLength)) throw new RangeError('SPLIT_MAX_LEN');

		return splitText;
	}

	splitText = text.split(char);

	if (splitText.some(({ length }) => length > maxLength)) throw new RangeError('SPLIT_MAX_LEN');

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
export function splitForEmbedFields(
	input: string,
	code = '',
	char = '\n',
	formatter: (text: string) => string = Util.escapeCodeBlock,
) {
	return splitMessage(Formatters.codeBlock(code, formatter(input)), {
		maxLength: EMBED_FIELD_MAX_CHARS,
		char: [char, ''],
		prepend: `\`\`\`${code}\n`,
		append: '```',
	});
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
export const readJSFiles = (root: string | URL) => readdirp(fileURLToPath(root), { fileFilter: ['*.js', '!~*'] });

/**
 * 99_137 -> 99K, 1_453_329 -> 1.5M
 * @param number
 * @param digits
 */
export function shortenNumber(number: number, digits?: number) {
	let str;
	let suffix;

	if (number < 1e3) {
		str = number;
		suffix = '';
	} else if (number < 1e6) {
		str = (number / 1e3).toFixed(digits ?? 0);
		suffix = 'K';
	} else if (number < 1e9) {
		str = (number / 1e6).toFixed(digits ?? 1);
		suffix = 'M';
	} else if (number < 1e12) {
		str = (number / 1e9).toFixed(digits ?? 2);
		suffix = 'B';
	} else if (number < 1e15) {
		str = (number / 1e12).toFixed(digits ?? 2);
		suffix = 'T';
	} else {
		// numbers bigger than 1T shouldn't occur
		str = number;
		suffix = '';
	}

	return `${str}${suffix}`;
}

/**
 * async random bytes generator to not block the event loop
 */
const asyncRandomBytes = promisify(randomBytes);

/**
 * async secure random number generator
 * modern js port of https://www.npmjs.com/package/random-number-csprng
 * @param minimum inclusive lower bound
 * @param maximum inclusive upper bound
 */
export async function randomNumber(minimum: number, maximum: number) {
	const range = maximum - minimum;

	let bitsNeeded = 0;
	let bytesNeeded = 0;
	let mask = 1;
	let range_ = range;

	/**
	 * This does the equivalent of:
	 *
	 *    bitsNeeded = Math.ceil(Math.log2(range));
	 *    bytesNeeded = Math.ceil(bitsNeeded / 8);
	 *    mask = Math.pow(2, bitsNeeded) - 1;
	 *
	 * ... however, it implements it as bitwise operations, to sidestep any
	 * possible implementation errors regarding floating point numbers in
	 * JavaScript runtimes. This is an easier solution than assessing each
	 * runtime and architecture individually.
	 */
	while (range_ > 0) {
		if (bitsNeeded % 8 === 0) {
			++bytesNeeded;
		}

		++bitsNeeded;
		mask = (mask << 1) | 1; /* 0x00001111 -> 0x00011111 */
		range_ = range_ >>> 1; /* 0x01000000 -> 0x00100000 */
	}

	for (;;) {
		const randomBytes_ = await asyncRandomBytes(bytesNeeded);

		let randomValue = 0;

		/* Turn the random bytes into an integer, using bitwise operations. */
		for (let i = 0; i < bytesNeeded; i++) {
			randomValue |= randomBytes_[i] << (8 * i);
		}

		/**
		 * We apply the mask to reduce the amount of attempts we might need
		 * to make to get a number that is in range. This is somewhat like
		 * the commonly used 'modulo trick', but without the bias:
		 *
		 *   "Let's say you invoke secure_rand(0, 60). When the other code
		 *    generates a random integer, you might get 243. If you take
		 *    (243 & 63) -- noting that the mask is 63 -- you get 51. Since
		 *    51 is less than 60, we can return this without bias. If we
		 *    got 255, then 255 & 63 is 63. 63 > 60, so we try again.
		 *
		 *    The purpose of the mask is to reduce the number of random
		 *    numbers discarded for the sake of ensuring an unbiased
		 *    distribution. In the example above, 243 would discard, but
		 *    (243 & 63) is in the range of 0 and 60."
		 *
		 *   (Source: Scott Arciszewski)
		 */
		randomValue = randomValue & mask;

		if (randomValue <= range) {
			/**
			 * We've been working with 0 as a starting point, so we need to
			 * add the `minimum` here.
			 */
			return minimum + randomValue;
		}

		/**
		 * Outside of the acceptable range, throw it away and try again.
		 * We don't try any modulo tricks, as this would introduce bias.
		 */
	}
}

/**
 * build autocomplete reponse from cached database entries
 * @param cache
 * @param value
 * @param nameKey
 * @param valueKey
 * @param max
 */
export function sortCache<T>(
	cache: Collection<string, T> | T[],
	value: string,
	nameKey: keyof T,
	valueKey: keyof T,
	max = MAX_CHOICES,
) {
	return (cache as T[])
		.map((element) => ({
			similarity: jaroWinklerSimilarity(value, element[nameKey] as unknown as string, {
				caseSensitive: false,
			}),
			element,
		}))
		.sort(({ similarity: a }, { similarity: b }) => b - a)
		.slice(0, max)
		.map(({ element }) => ({
			name: element[nameKey] as unknown as string,
			value: element[valueKey] as unknown as string,
		}));
}
