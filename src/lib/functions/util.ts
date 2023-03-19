import { setTimeout as sleep } from 'node:timers/promises';
import { AutoCompleteLimits } from '@sapphire/discord-utilities';
import type { PickByValue } from '@sapphire/utilities';
import type { Awaitable, Collection } from 'discord.js';
import { jaroWinklerSimilarity } from '#functions/stringUtil.js';
import { logger } from '#logger';

interface AutocorrectResult<T> {
	/**
	 * 0 (no match) to 1 (exact match)
	 */
	similarity: number;
	value: T;
}

/**
 * checks the query against the validInput and returns the most likely match
 *
 * @param query
 * @param validInput
 * @param attributeToQuery
 */
export function autocorrect(
	query: string,
	validInput: IterableIterator<string> | ReadonlyMap<unknown, string> | readonly string[],
	attributeToQuery?: undefined,
): AutocorrectResult<string>;
export function autocorrect<T>(
	query: string,
	validInput: IterableIterator<T> | ReadonlyMap<unknown, T> | readonly T[],
	attributeToQuery: PickByValue<T, string>,
): AutocorrectResult<T>;
export function autocorrect<T>(
	query: string,
	validInput: IterableIterator<T> | ReadonlyMap<unknown, T> | readonly T[],
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
 *
 * @param string
 * @param regex
 * @param callback
 */
export async function asyncReplace(
	string: string,
	regex: RegExp,
	callback: (match: RegExpExecArray) => Awaitable<string>,
) {
	let promises: Promise<{ length: number; start: number; value: string }>[] | undefined;
	let match: RegExpExecArray | null;

	while ((match = regex.exec(string)) !== null) {
		(promises ??= []).push(
			// eslint-disable-next-line unicorn/no-unreadable-iife, @typescript-eslint/no-loop-func
			(async () => ({
				start: match.index!,
				length: match[0]!.length,
				value: await callback(match),
			}))(),
		);
	}

	if (!promises) return string;

	let replaced = string;
	let offset = 0;

	for (const { start, length, value } of await Promise.all(promises)) {
		replaced = `${replaced.slice(0, start - offset)}${value}${replaced.slice(start - offset + length)}`;
		offset += length - value.length;
	}

	return replaced;
}

/**
 * Array.prototype.filter with an asynchronous callback function
 *
 * @param array
 * @param predicate
 */
export async function asyncFilter<T>(
	array: T[],
	predicate: (value: T, index: number, array: T[]) => Awaitable<boolean>,
): Promise<T[]> {
	const fail = Symbol('fail');

	return (
		await Promise.all(array.map(async (item, index) => ((await predicate(item, index, array)) ? item : fail)))
	).filter((x): x is Awaited<T> => x !== fail);
}

/**
 * waits for all promises to settle and logs the errored ones
 *
 * @param array
 */
export async function safePromiseAll(array: unknown[]) {
	for (const x of await Promise.allSettled(array)) {
		if (x.status === 'rejected') logger.error(x.reason);
	}
}

/**
 * build autocomplete response from cached database entries
 *
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
 * retries if func rejects
 *
 * @param func
 * @param delay
 * @param maxDelay
 * @param retries
 */
export async function retry<T>(func: () => Promise<T>, delay: number, maxDelay: number, retries = 0): Promise<T> {
	try {
		return await func();
	} catch (error) {
		logger.error({ err: error, retries }, '[RETRY]');

		await sleep(Math.min(retries * delay, maxDelay));
		return retry(func, delay, maxDelay, retries + 1);
	}
}
