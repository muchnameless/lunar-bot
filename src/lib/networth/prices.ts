import { setTimeout } from 'node:timers';
import { ItemId } from './constants/index.js';
import { sql } from '#db';
import { minutes } from '#functions';
import { logger } from '#logger';
import { type ParsedSkyBlockItem } from '#root/jobs/pricesAndPatchNotes.js';
import { Warnings } from '#structures/Warnings.js';

export type ItemUpgrade = Pick<ParsedSkyBlockItem, 'dungeon_conversion' | 'prestige' | 'stars'>;

export const prices = new Map<string, number>();
export const itemUpgrades = new Map<string, ItemUpgrade>();
export const accessories = new Set<string>();

export const unknownItemIdWarnings = new Warnings<string>();

export const getPrice = (itemId: string) =>
	prices.get(itemId) ?? (unknownItemIdWarnings.emit(itemId, { itemId }, '[GET PRICE]: unknown item'), 0);

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

		prices.set(ItemId.Coins, 1);

		for (const { id, median } of pricesRows) {
			prices.set(id, median);
		}

		// item upgrades
		const itemUpgradesRows = await sql<[ItemUpgrade & Pick<ParsedSkyBlockItem, 'id'>]>`
			SELECT id, dungeon_conversion, stars, prestige from skyblock_items WHERE dungeon_conversion IS NOT NULL OR stars IS NOT NULL OR prestige IS NOT NULL
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
		setTimeout(() => void populateCaches(), minutes(1));
	}
}

void populateCaches();
