import { logger } from '../../functions';
import { sql } from '../database';

export const prices = new Map<string, number>();
export const getPrice = (item: string) => prices.get(item) ?? 0;

/**
 * queries the prices database
 */
export async function populatePrices() {
	prices.clear();

	try {
		for (const { id, median } of await sql<[{ id: string; median: number }]>`
			SELECT id, median(history) from prices
		`) {
			prices.set(id, median);
		}
	} catch (error) {
		logger.error(error);
	}
}

// eslint-disable-next-line unicorn/prefer-top-level-await
void populatePrices();
