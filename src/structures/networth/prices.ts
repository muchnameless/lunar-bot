import { setTimeout } from 'node:timers';
import { logger } from '../../logger';
import { sql } from '../database';
import { minutes } from '../../functions';
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
	try {
		// prices
		const pricesRows = await sql<[{ id: string; median: number }]>`
			SELECT id, median(history) from prices
		`;

		prices.clear();

		for (const { id, median } of pricesRows) {
			prices.set(id, median);
		}

		// item upgrades
		const itemUpgradesRows = await sql<[Pick<ParsedSkyBlockItem, 'id'> & ItemUpgrade]>`
			SELECT id, dungeon_conversion, stars from skyblock_items WHERE stars IS NOT NULL
		`;

		itemUpgrades.clear();

		for (const { id, ...data } of itemUpgradesRows) {
			itemUpgrades.set(id, data);
		}

		// accessories
		const accessoriesRows = await sql<[{ id: string }]>`
			SELECT id from skyblock_items WHERE category = 'ACCESSORY'
		`;

		accessories.clear();

		for (const { id } of accessoriesRows) {
			accessories.add(id);
		}
	} catch (error) {
		logger.error(error, '[POPULATE CACHES]');

		// retry
		setTimeout(() => populateCaches(), minutes(1));
	}
}

// eslint-disable-next-line unicorn/prefer-top-level-await
void populateCaches();
