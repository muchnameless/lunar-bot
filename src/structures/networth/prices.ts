import { logger } from '../../logger';
import { sql } from '../database';
import type { ParsedSkyBlockItem } from '../../jobs/pricesAndPatchNotes';

export const prices = new Map<string, number>();
export const itemUpgrades = new Map<string, Omit<ParsedSkyBlockItem, 'id'>>();
export const getPrice = (item: string) => prices.get(item) ?? 0;

/**
 * queries the prices database
 */
export async function populateCaches() {
	// prices
	prices.clear();

	try {
		for (const { id, median } of await sql<[{ id: string; median: number }]>`
			SELECT id, median(history) from prices
		`) {
			prices.set(id, median);
		}
	} catch (error) {
		logger.error(error, '[POPULATE CACHES]: prices');
	}

	// items
	itemUpgrades.clear();

	try {
		for (const { id, ...data } of await sql<[ParsedSkyBlockItem]>`
			SELECT * from skyblock_items
		`) {
			itemUpgrades.set(id, data);
		}
	} catch (error) {
		logger.error(error, '[POPULATE CACHES]: skyblock_items');
	}
}

// eslint-disable-next-line unicorn/prefer-top-level-await
void populateCaches();
