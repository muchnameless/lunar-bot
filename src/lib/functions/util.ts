import { URL } from 'node:url';
import { opendir } from 'node:fs/promises';
import { AutoCompleteLimits } from '@sapphire/discord-utilities';
import { logger } from '#logger';
import { jaroWinklerSimilarity, weeks } from '.';
import type { Awaitable, PickByValue } from '@sapphire/utilities';
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

	return Math.ceil((firstThursday - target.getTime()) / weeks(1)) + 1;
}

interface AutocorrectResult<T> {
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
	validInput: readonly string[] | ReadonlyMap<unknown, string> | IterableIterator<string>,
	attributeToQuery?: undefined,
): AutocorrectResult<string>;
export function autocorrect<T>(
	query: string,
	validInput: readonly T[] | ReadonlyMap<unknown, T> | IterableIterator<T>,
	attributeToQuery: PickByValue<T, string>,
): AutocorrectResult<T>;
export function autocorrect<T>(
	query: string,
	validInput: readonly T[] | ReadonlyMap<unknown, T> | IterableIterator<T>,
	attributeToQuery?: PickByValue<T, string>,
) {
	let currentBestElement!: T;
	let currentBestSimilarity = 0;

	if (attributeToQuery) {
		for (const element of (validInput as ReadonlyMap<unknown, T>).values?.() ?? validInput) {
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
		for (const element of (validInput as ReadonlyMap<unknown, T>).values?.() ?? validInput) {
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
			// eslint-disable-next-line unicorn/no-unreadable-iife
			(async () => ({
				start: match.index!,
				length: match[0]!.length,
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
	predicate: (value: T, index: number, array: T[]) => Awaitable<boolean>,
): Promise<T[]> {
	const fail = Symbol();

	return (
		await Promise.all(array.map(async (item, index) => ((await predicate(item, index, array)) ? item : fail)))
	).filter((x) => x !== fail) as T[];
}

type CopyFunction<F, R> = F extends (...p: infer P) => any ? (...p: P) => R : never;
type CollectionFilter<I extends Collection<K, V>, K = unknown, V = unknown> = CopyFunction<
	Parameters<I['filter']>[0],
	Awaitable<ReturnType<Parameters<I['filter']>[0]>>
>;
type Value<C> = C extends Collection<any, infer V> ? V : never;

/**
 * Collection.prototype.filter with an asynchronous callback function, returns an array
 * @param iterable
 * @param predicate
 */
export async function asyncCollectionFilter<I extends Collection<K, V>, K, V>(
	iterable: I,
	predicate: CollectionFilter<I>,
): Promise<Value<I>[]> {
	const fail = Symbol();

	return (
		await Promise.all(iterable.map(async (item, index) => ((await predicate(item, index, iterable)) ? item : fail)))
	).filter((x) => x !== fail) as Value<I>[];
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
 * creates an async iterable from all .js files that don't start with a '~'
 * @param root
 */
export async function* readJSFiles(root: string | URL): AsyncGenerator<string> {
	for await (const dir of await opendir(root)) {
		if (dir.name.startsWith('~')) continue;
		if (dir.isDirectory()) yield* readJSFiles(new URL(`${dir.name}/`, root));
		if (!dir.name.endsWith('.js')) continue;
		yield new URL(dir.name, root).href;
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
	max: number = AutoCompleteLimits.MaximumAmountOfOptions,
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

/**
 * stringifies the error and removes html code from it
 * @param error
 */
export const formatError = (error: unknown) => `${error}`.replace(/(?:\.? Response: )?<html>.+<\/html>/s, '');
