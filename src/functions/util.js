'use strict';

const { Formatters, Util } = require('discord.js');
const { setTimeout } = require('timers/promises');
const ms = require('ms');
const jaroWinklerSimilarity = require('jaro-winkler');
const { EMBED_FIELD_MAX_CHARS } = require('../constants/discord');
const logger = require('./logger');

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

/**
 * @param {string[]} splitText
 * @param {import('discord.js').SplitOptions} [options] Options controlling the behavior of the split
 * @returns {string[]}
 */
function _concatMessageChunks(splitText, { maxLength, char, append, prepend }) {
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


const self = module.exports = {

	/**
	 * usage: await sleep(milliseconds)
	 * @param {number} milliseconds to sleep
	 */
	sleep: setTimeout,

	/**
	 * lets you insert any string as the plain string into a regex
	 * @param {string} string to escape
	 */
	escapeRegex: string => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),

	/**
	 * escapes discord markdown in igns
	 * @param {string} string to escape
	 */
	escapeIgn: string => string.replace(/_/g, '\\_'),

	/**
	 * extracts user IDs from @mentions
	 * @param {string} string to analyze
	 */
	getIdFromString: string => string.match(/(?<=^(?:<@!?)?)\d{17,19}(?=>?$)/)?.[0] ?? null,

	/**
	 * abc -> Abc
	 * @param {string} string to convert
	 */
	upperCaseFirstChar: string => `${string.charAt(0).toUpperCase()}${string.slice(1).toLowerCase()}`,

	/**
	 * removes ',', '.' and '_' from the input string
	 * @param {?string} string input
	 */
	removeNumberFormatting: string => string?.replace(/,|\.|_/g, ''),

	/**
	 * trims a string to a certain length
	 * @param {string} string to trim
	 * @param {number} max maximum length
	 */
	trim: (string, max) => (string.length > max ? `${string.slice(0, max - 3)}...` : string),

	/**
	 * replaces toLocaleString('fr-FR') separator with a normal space
	 * @param {string} string
	 */
	cleanFormattedNumber: string => string.replace(/\u{202F}/ug, ' '),

	/**
	 * '30d1193h71585m4295001s' -> 15_476_901_000
	 * @param {string} string
	 */
	stringToMS: string => string.split(/(?<=[a-z])(?=\d)/).reduce((acc, cur) => acc + ms(cur), 0),

	/**
	 * returns the ISO week number of the given date
	 * @param {Date} date to analyze
	 */
	getWeekOfYear(date) {
		const target = new Date(date.valueOf());
		const dayNumber = (date.getUTCDay() + 6) % 7;

		target.setUTCDate(target.getUTCDate() - dayNumber + 3);

		const firstThursday = target.valueOf();

		target.setUTCMonth(0, 1);

		if (target.getUTCDay() !== 4) {
			target.setUTCMonth(0, 1 + (((4 - target.getUTCDay()) + 7) % 7));
		}

		return Math.ceil((firstThursday - target) / (7 * 24 * 3_600_000)) + 1;
	},

	/**
	 * checks the query agains the validInput and returns the most likely match
	 * @param {string} query
	 * @param {any[]} validInput
	 * @param {string} attributeToQuery
	 */
	autocorrect(query, validInput, attributeToQuery = null) {
		let currentBestElement;
		let currentBestSimilarity = 0;

		for (const element of validInput.values()) {
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
	},

	/**
	 * <Array>.filter with an asynchronous callback function
	 * @param {Array} arr
	 * @param {Function} callback
	 */
	async asyncFilter(arr, callback) {
		const fail = Symbol();
		return (await Promise.all(arr.map(async item => ((await callback(item)) ? item : fail)))).filter(i => i !== fail);
	},

	/**
	 * compares to strings alphabetically, case insensitive
	 * @param {string} a
	 * @param {string} b
	 */
	compareAlphabetically(a, b) {
		return collator.compare(a, b);
	},

	/**
	 * Splits a string into multiple chunks at a designated character that do not exceed a specific length.
	 * @param {string} text Content to split
	 * @param {import('discord.js').SplitOptions} [options] Options controlling the behavior of the split
	 * @returns {string[]}
	 */
	splitMessage(text, { maxLength = 2_000, char = '\n', prepend = '', append = '' } = {}) {
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

							return matched.map(match => _concatMessageChunks(chunk.split(match), { maxLength, char: match, prepend, append }));
						}

						// no global flag
						const matched = chunk.match(currentChar)?.[0];

						if (!matched) return chunk;

						return _concatMessageChunks(chunk.split(matched), { maxLength, char: matched, prepend, append });
					});
				} else {
					splitText = splitText.flatMap(chunk => (chunk.length > maxLength ? _concatMessageChunks(chunk.split(currentChar), { maxLength, char: currentChar, prepend, append }) : chunk));
				}
			}

			if (splitText.some(({ length }) => length > maxLength)) throw new RangeError('SPLIT_MAX_LEN');

			return splitText;
		}

		splitText = text.split(char);

		if (splitText.some(({ length }) => length > maxLength)) throw new RangeError('SPLIT_MAX_LEN');

		return _concatMessageChunks(splitText, { maxLength, char, append, prepend });
	},

	/**
	 * TEMPORARY replacement until discordjs/builders includes a message builder
	 * @param {string} text
	 * @param {object} options
	 */
	makeContent(text = '', options = {}) {
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

		return self.splitMessage(content, splitOptions);
	},

	/**
	 * generates an array of code blocks
	 * @param {string} input
	 * @param {string} [code='']
	 * @param {string} [char='\n']
	 * @param {Function} [formatter=Util.escapeCodeBlock]
	 */
	splitForEmbedFields(input, code = '', char = '\n', formatter = Util.escapeCodeBlock) {
		const TO_SPLIT = Formatters.codeBlock(code, formatter(input));

		return self.splitMessage(TO_SPLIT, { maxLength: EMBED_FIELD_MAX_CHARS, char: [ char, '' ], prepend: `\`\`\`${code}\n`, append: '```' });
	},

	/**
	 * waits for all promises to settle and logs the errored ones
	 * @param {Promise<any>[]} arr
	 */
	async safePromiseAll(arr) {
		for (const x of await Promise.allSettled(arr)) {
			if (x.status === 'rejected') logger.error(x.reason);
		}
	},
};
