import { logger } from '../../logger';
import { sql } from '../database';
import type { ParsedSkyBlockItem } from '../../jobs/pricesAndPatchNotes';

export interface ItemUpgrade {
	dungeon_conversion: ParsedSkyBlockItem['dungeon_conversion'];
	stars: NonNullable<ParsedSkyBlockItem['stars']>;
}

export const prices = new Map<string, number>();
export const itemUpgrades = new Map<string, ItemUpgrade>();
export const accessories = new Set<string>();
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
		for (const { id, ...data } of await sql<[Pick<ParsedSkyBlockItem, 'id' | 'dungeon_conversion'> & ItemUpgrade]>`
			SELECT id, dungeon_conversion, stars from skyblock_items WHERE stars IS NOT NULL
		`) {
			itemUpgrades.set(id, data);
		}
	} catch (error) {
		logger.error(error, '[POPULATE CACHES]: skyblock_items');
	}

	// accessories
	accessories.clear();

	try {
		for (const { id } of await sql<[{ id: string }]>`
			SELECT id from skyblock_items WHERE category = 'ACCESSORY'
		`) {
			accessories.add(id);
		}
	} catch (error) {
		logger.error(error, '[POPULATE CACHES]: talismans');
	}
}

// eslint-disable-next-line unicorn/prefer-top-level-await
void populateCaches();
