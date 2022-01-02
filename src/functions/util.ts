import { fileURLToPath } from 'node:url';
import readdirp from 'readdirp';
import { MAX_CHOICES } from '../constants';
import { days, jaroWinklerSimilarity, logger } from '.';
import type { URL } from 'node:url';
import type { Collection } from 'discord.js';

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

interface AutocompleteResult<T> {
	value: T;
	/** 0 (no match) to 1 (exact match) */
	similarity: number;
}

/**
 * checks the query agains the validInput and returns the most likely match
 * @param query
 * @param validInput
 * @param attributeToQuery
 */
export function autocorrect(
	query: string,
	validInput: readonly string[] | Map<unknown, string> | IterableIterator<string>,
): AutocompleteResult<string>;
export function autocorrect<T>(
	query: string,
	validInput: readonly T[] | Map<unknown, T> | IterableIterator<T>,
	attributeToQuery: keyof T,
): AutocompleteResult<T>;
export function autocorrect<T>(
	query: string,
	validInput: readonly T[] | Map<unknown, T> | IterableIterator<T>,
	attributeToQuery?: T[keyof T] extends string ? keyof T : never,
) {
	let currentBestElement!: T;
	let currentBestSimilarity = 0;

	if (attributeToQuery) {
		for (const element of (validInput as Map<unknown, T>).values?.() ?? validInput) {
			const similarity = jaroWinklerSimilarity(query, element[attributeToQuery] as unknown as string);

			if (similarity === 1) {
				return {
					value: element,
					similarity: 1,
				};
			}

			if (similarity < currentBestSimilarity) continue;

			currentBestElement = element;
			currentBestSimilarity = similarity;
		}

		logger.debug(
			{
				query,
				value: currentBestElement[attributeToQuery],
				similarity: currentBestSimilarity,
			},
			'[AUTOCORRECT]',
		);
	} else {
		for (const element of (validInput as Map<unknown, T>).values?.() ?? validInput) {
			const similarity = jaroWinklerSimilarity(query, element as unknown as string);

			if (similarity === 1) {
				return {
					value: element,
					similarity: 1,
				};
			}

			if (similarity < currentBestSimilarity) continue;

			currentBestElement = element;
			currentBestSimilarity = similarity;
		}

		logger.debug(
			{
				query,
				value: currentBestElement,
				similarity: currentBestSimilarity,
			},
			'[AUTOCORRECT]',
		);
	}

	return {
		value: currentBestElement,
		similarity: currentBestSimilarity,
	};
}

/**
 * String.prototype.replace with an asynchronous callback function
 * @param string
 * @param regex
 * @param callback
 */
export async function asyncReplace(
	string: string,
	regex: RegExp,
	callback: (match: RegExpMatchArray) => string | Promise<string>,
) {
	const promises: Promise<{ start: number; length: number; value: string }>[] = [];

	for (const match of string.matchAll(regex)) {
		promises.push(
			(async () => ({
				start: match.index!,
				length: match[0].length,
				value: await callback(match),
			}))(),
		);
	}

	if (!promises.length) return string;

	let offset = 0;

	return (await Promise.all(promises)).reduce((acc, { start, length, value }) => {
		const REPLACED = `${acc.slice(0, start - offset)}${value}${acc.slice(start - offset + length)}`;
		offset += length - value.length;
		return REPLACED;
	}, string);
}

/**
 * Array.prototype.filter with an asynchronous callback function
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

/**
 * waits for all promises to settle and logs the errored ones
 * @param array
 */
export async function safePromiseAll(array: unknown[]) {
	for (const x of await Promise.allSettled(array)) {
		if (x.status === 'rejected') logger.error(x.reason);
	}
}

/**
 * creates a 'await for..of'-consumable ReaddirpStream from all .js files that don't start with a '~'
 * @param root
 */
export const readJSFiles = (root: string | URL) => readdirp(fileURLToPath(root), { fileFilter: ['*.js', '!~*'] });

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
			similarity: jaroWinklerSimilarity(value, element[nameKey] as unknown as string),
			element,
		}))
		.sort(({ similarity: a }, { similarity: b }) => b - a)
		.slice(0, max)
		.map(({ element }) => ({
			name: element[nameKey] as unknown as string,
			value: element[valueKey] as unknown as string,
		}));
}
