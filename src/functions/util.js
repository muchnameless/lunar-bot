'use strict';

const { Util: { splitMessage, escapeCodeBlock } } = require('discord.js');
const { promisify } = require('util');
const ms = require('ms');
const jaroWinklerSimilarity = require('jaro-winkler');
const { XP_TYPES, XP_OFFSETS_SHORT } = require('../constants/database');
const { EMBED_FIELD_MAX_CHARS } = require('../constants/discord');
const hypixel = require('../api/hypixel');
const hypixelAux = require('../api/hypixelAux');
const logger = require('./logger');

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });


const self = module.exports = {

	/**
	 * usage: await sleep(milliseconds)
	 * @param {number} milliseconds to sleep
	 */
	sleep: promisify(setTimeout),

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
	getIDFromString: string => string.match(/<@!?(\d+)>/)?.[1] ?? null,

	/**
	 * abc -> Abc
	 * @param {string} string to convert
	 */
	upperCaseFirstChar: string => `${string.charAt(0).toUpperCase()}${string.slice(1)}`,

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
	 * day.month.year -> year/month/day
	 * @param {string} string to convert
	 */
	reverseDateInput: (string => string
		.split('.')
		.reverse()
		.join('/')
	),

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
	 * returns the hypixel client
	 * @param {boolean} shouldSkipQueue wether to use the hypixel aux client when the main one's request queue is filled
	 */
	getHypixelClient: ((shouldSkipQueue = false) => ((shouldSkipQueue && hypixel.queue.promises.length > hypixelAux.queue.promises.length)
		? hypixelAux
		: hypixel)
	),

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
	 * cleans a string from an embed for console logging
	 * @param {string} string the string to clean
	 */
	cleanLoggingEmbedString(string) {
		return typeof string === 'string'
			? string
				.replace(/```(?:js|diff|cs|ada|undefined)?\n/g, '') // code blocks
				.replace(/`|\*|\n?\u200b|\\(?=_)/g, '') // inline code blocks, discord formatting, escaped '_'
				.replace(/\n{2,}/g, '\n') // consecutive line-breaks
			: null;
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
	 * checks the query agains the validInput and returns the most likely match
	 * @param {string} query
	 * @param {any[]} validInput
	 * @param {string} attributeToQuery
	 */
	autocorrectV2(query, validInput = [], attributeToQuery = null) {
		return (attributeToQuery
			? validInput.map(value => ({
				value,
				similarity: jaroWinklerSimilarity(query, value[attributeToQuery], { caseSensitive: false }),
			}))
			: validInput.map(value => ({
				value,
				similarity: jaroWinklerSimilarity(query, value, { caseSensitive: false }),
			})))
			.sort((a, b) => {
				if (a.similarity < b.similarity) return 1;
				if (a.similarity > b.similarity) return -1;
				return 0;
			})[0];
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
	 * autocorrects a string to one of the supported types
	 * @param {string} input
	 */
	autocorrectToType(input) {
		const result = self.autocorrect(input, [ 'skill', 'slayer', 'revenant', 'tarantula', 'sven', 'dungeon', 'gxp', 'weight', ...XP_TYPES ]);

		switch (result.value) {
			case 'revenant':
				result.value = 'zombie';
				break;
			case 'tarantula':
				result.value = 'spider';
				break;
			case 'sven':
				result.value = 'wolf';
				break;
			case 'dungeon':
				result.value = 'catacombs';
				break;
			case 'gxp':
				result.value = 'guild';
				break;
		}

		return result;
	},

	/**
	 * autocorrects a string to a db offset using short names
	 * @param {string} input message flags
	 */
	autocorrectToOffset(input) {
		const result = self.autocorrect(input, Object.keys(XP_OFFSETS_SHORT));

		result.value = XP_OFFSETS_SHORT[result.value];

		return result;
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
	 * generates an array of code blocks
	 * @param {string} input
	 * @param {string} [code='']
	 * @param {string} [char='\n']
	 * @param {Function} [formatter=escapeCodeBlock]
	 */
	splitForEmbedFields(input, code = '', char = '\n', formatter = escapeCodeBlock) {
		const TO_SPLIT = `\`\`\`${code}\n${formatter(input?.toString?.())}\`\`\``;

		try {
			return splitMessage(TO_SPLIT, { maxLength: EMBED_FIELD_MAX_CHARS, char, prepend: `\`\`\`${code}\n`, append: '```' });
		} catch {
			return splitMessage(TO_SPLIT, { maxLength: EMBED_FIELD_MAX_CHARS, char: '', prepend: `\`\`\`${code}\n`, append: '```' });
		}
	},
};
