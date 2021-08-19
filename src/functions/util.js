import { Formatters, Util } from 'discord.js';
import ms from 'ms';
import jaroWinklerSimilarity from 'jaro-winkler';
import { EMBED_FIELD_MAX_CHARS } from '../constants/index.js';
import { logger } from './index.js';


/**
 * lets you insert any string as the plain string into a regex
 * @param {string} string to escape
 */
export const escapeRegex = string => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * escapes discord markdown in igns
 * @param {string} string to escape
 */
export const escapeIgn = string => string.replace(/_/g, '\\_');

/**
 * extracts user IDs from @mentions
 * @param {string} string to analyze
 */
export const getIdFromString = string => string.match(/(?<=^(?:<@!?)?)\d{17,19}(?=>?$)/)?.[0] ?? null;

/**
 * aBc -> Abc
 * @param {string} string to convert
 */
export const upperCaseFirstChar = string => `${string[0].toUpperCase()}${string.slice(1).toLowerCase()}`;

/**
 * removes ',', '.' and '_' from the input string
 * @param {?string} string input
 */
export const removeNumberFormatting = string => string?.replace(/,|\.|_/g, '');

/**
 * trims a string to a certain length
 * @param {string} string to trim
 * @param {number} max maximum length
 */
export const trim = (string, max) => (string.length > max ? `${string.slice(0, max - 3)}...` : string);

/**
 * replaces toLocaleString('fr-FR') separator with a normal space
 * @param {string} string
 */
export const cleanFormattedNumber = string => string.replace(/\u{202F}/ug, ' ');

/**
 * '30d1193h71585m4295001s' -> 15_476_901_000
 * @param {string} string
 */
export const stringToMS = string => string.split(/(?<=[a-z])(?=\d)/).reduce((acc, cur) => acc + ms(cur), 0);

/**
 * returns the ISO week number of the given date
 * @param {Date} date to analyze
 */
export function getWeekOfYear(date) {
	const target = new Date(date.valueOf());
	const dayNumber = (date.getUTCDay() + 6) % 7;

	target.setUTCDate(target.getUTCDate() - dayNumber + 3);

	const firstThursday = target.valueOf();

	target.setUTCMonth(0, 1);

	if (target.getUTCDay() !== 4) {
		target.setUTCMonth(0, 1 + (((4 - target.getUTCDay()) + 7) % 7));
	}

	return Math.ceil((firstThursday - target) / (7 * 24 * 3_600_000)) + 1;
}

/**
 * checks the query agains the validInput and returns the most likely match
 * @param {string} query
 * @param {any[] | Map<any, any>} validInput
 * @param {string} attributeToQuery
 */
export function autocorrect(query, validInput, attributeToQuery = null) {
	let currentBestElement;
	let currentBestSimilarity = 0;

	for (const element of validInput.values?.() ?? validInput) {
		const similarity = jaroWinklerSimilarity(query, attributeToQuery ? element[attributeToQuery] : element, { caseSensitive: false });

		if (similarity === 1) return {
			value: element,
			similarity,
		};

		if (similarity < currentBestSimilarity) continue;

		currentBestElement = element;
		currentBestSimilarity = similarity;
	}

	logger.info(`[AUTOCORRECT]: autocorrected '${query}' to '${currentBestElement[attributeToQuery] ?? currentBestElement}' with a certainty of ${currentBestSimilarity}`);

	return {
		value: currentBestElement,
		similarity: currentBestSimilarity,
	};
}

/**
 * <Array>.filter with an asynchronous callback function
 * @param {Array} arr
 * @param {Function} callback
 */
export async function asyncFilter(arr, callback) {
	const fail = Symbol();
	return (await Promise.all(arr.map(async item => ((await callback(item)) ? item : fail)))).filter(i => i !== fail);
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

/**
 * compares to strings alphabetically, case insensitive
 * @param {string} a
 * @param {string} b
 */
export const compareAlphabetically = (a, b) => collator.compare(a, b);

/**
 * @param {string[]} splitText
 * @param {import('discord.js').SplitOptions} [options] Options controlling the behavior of the split
 * @returns {string[]}
 */
function concatMessageChunks(splitText, { maxLength, char, append, prepend }) {
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
 * @param {string} text Content to split
 * @param {import('discord.js').SplitOptions} [options] Options controlling the behavior of the split
 * @returns {string[]}
 */
export function splitMessage(text, { maxLength = 2_000, char = '\n', prepend = '', append = '' } = {}) {
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
 * @param {string} text
 * @param {object} options
 */
export function makeContent(text = '', options = {}) {
	const isSplit = typeof options.split !== 'undefined' && options.split !== false;
	const isCode = typeof options.code !== 'undefined' && options.code !== false;
	const splitOptions = isSplit ? { ...options.split } : undefined;

	let content = text;

	if (isCode) {
		const codeName = typeof options.code === 'string'
			? options.code
			: '';

		content = Formatters.codeBlock(codeName, Util.cleanCodeBlockContent(content));

		if (isSplit) {
			splitOptions.prepend = `${splitOptions.prepend ?? ''}\`\`\`${codeName}\n`;
			splitOptions.append = `\n\`\`\`${splitOptions.append ?? ''}`;
		}
	}

	return splitMessage(content, splitOptions);
}

/**
 * generates an array of code blocks
 * @param {string} input
 * @param {string} [code='']
 * @param {string} [char='\n']
 * @param {Function} [formatter=Util.escapeCodeBlock]
 */
export function splitForEmbedFields(input, code = '', char = '\n', formatter = Util.escapeCodeBlock) {
	const TO_SPLIT = Formatters.codeBlock(code, formatter(input));

	return splitMessage(TO_SPLIT, { maxLength: EMBED_FIELD_MAX_CHARS, char: [ char, '' ], prepend: `\`\`\`${code}\n`, append: '```' });
}

/**
 * waits for all promises to settle and logs the errored ones
 * @param {Promise<any>[]} arr
 */
export async function safePromiseAll(arr) {
	for (const x of await Promise.allSettled(arr)) {
		if (x.status === 'rejected') logger.error(x.reason);
	}
}

/**
 * removes minecraft formatting codes
 * @param {string} string
 */
export const removeMcFormatting = string => string.replace(/§[0-9a-gk-or]/g, '');
