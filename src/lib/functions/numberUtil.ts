import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * 99_137 -> 99K, 1_453_329 -> 1.5M
 * @param number
 * @param digits
 */
export function shortenNumber(number: number, digits?: number) {
	let str: string | number;
	let suffix: string;

	if (number < 1e3) {
		str = number.toFixed(digits ?? 0);
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
		str = number.toFixed(digits ?? 0);
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
 *
 * DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE
 * Version 2, December 2004
 *
 * Copyright (C) 2004 Sam Hocevar <sam@hocevar.net>
 *
 * Everyone is permitted to copy and distribute verbatim or modified
 * copies of this license document, and changing it is allowed as long
 * as the name is changed.
 *
 * DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE
 * TERMS AND CONDITIONS FOR COPYING, DISTRIBUTION AND MODIFICATION
 *
 * 0. You just DO WHAT THE FUCK YOU WANT TO.
 *
 * @param minimum inclusive lower bound
 * @param maximum inclusive upper bound
 */
export async function randomNumber(minimum: number, maximum: number) {
	const range = maximum - minimum;
	const bitsNeeded = Math.ceil(Math.log2(range));
	const bytesNeeded = Math.ceil(bitsNeeded / 8);
	const mask = 2 ** bitsNeeded - 1;

	for (;;) {
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
		const randomValue = (await asyncRandomBytes(bytesNeeded)).reduce((acc, cur, i) => acc | (cur << (8 * i))) & mask;

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

interface DecimalNumberFormattingOptions {
	/** amount to space-pad at the start */
	padding?: number;
	/** amount of decimals to round to */
	decimals?: number;
}

/**
 * space-padding at the beginning and '0'-padding at the end
 * @param number number to format
 * @param options
 */
export function formatDecimalNumber(
	number: number,
	{ padding = 0, decimals = 2 }: DecimalNumberFormattingOptions = {},
) {
	if (Number.isNaN(number)) return 'NaN'.padStart(padding, ' ');

	const [BEFORE_DOT, AFTER_DOT] = number.toFixed(decimals).split('.');

	return `${Number(BEFORE_DOT).toLocaleString('fr-FR').padStart(padding, ' ')}.${AFTER_DOT}`;
}

interface NumberFormattingOptions {
	/** amount to space-pad at the start */
	padding?: number;
}

/**
 * space-padding at the beginning, converterFunction and locale string formatting
 * @param number number to format
 * @param options
 */
export const formatNumber = (number: number, { padding = 0 }: NumberFormattingOptions = {}) =>
	number.toLocaleString('fr-FR').replace(',', '.').padStart(padding, ' ');

/**
 * formats a number as percentage
 * @param number
 */
export function formatPercent(number: number) {
	if (Number.isNaN(number)) return '0%';
	return `${(100 * number).toFixed(1)}%`;
}
