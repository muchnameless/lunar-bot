import { setTimeout } from 'node:timers';
import { Collection } from 'discord.js';
import { Enchantment, ItemId } from './constants/index.js';
import { sql } from '#db';
import { minutes } from '#functions';
import { logger } from '#logger';
import type { ParsedSkyBlockItem } from '#root/jobs/pricesAndPatchNotes.js';
import { Warnings } from '#structures/Warnings.js';

export type SkyBlockItem = Omit<ParsedSkyBlockItem, 'id'>;

export const prices = new Collection<string, number>();
export const skyblockItems = new Collection<string, SkyBlockItem>();

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
			SELECT
				id,
				median(history)
			FROM
				prices
		`;

		prices.clear();

		for (const { id, median } of pricesRows) {
			prices.set(id, median);
		}

		/**
		 * hardcoded prices
		 */

		// coins (for crafting recipes)
		prices.set(ItemId.Coins, 1);

		// base items (price is determined using ExtraAttributes)
		for (const itemId of [
			ItemId.AbiCase,
			ItemId.AttributeShard,
			ItemId.EnchantedBook,
			ItemId.NewYearCake,
			ItemId.PartyHatCrab,
			ItemId.PartyHatCrabAnimated,
			ItemId.Pet,
			ItemId.Potion,
			ItemId.Rune,
		]) {
			prices.set(itemId, 0);
		}

		// https://hypixel-skyblock.fandom.com/wiki/Divine_Gift
		prices.set(`ENCHANTMENT_${Enchantment.DivineGift}_1`, 25e6);

		await populateSkyBlockItems();
	} catch (error) {
		logger.error(error, '[POPULATE CACHES]');

		// retry
		setTimeout(() => void populateCaches(), minutes(1));
	}
}

/**
 * queries the skyblock_items database
 */
export async function populateSkyBlockItems() {
	// item upgrades
	const itemUpgradesRows = await sql<[ParsedSkyBlockItem]>`
		SELECT
			*
		FROM
			skyblock_items
		WHERE
			category IS NOT NULL OR
			dungeon_conversion IS NOT NULL OR
			gemstone_slots IS NOT NULL OR
			npc_sell_price IS NOT NULL OR
			prestige IS NOT NULL OR
			soulbound IS TRUE OR
			stars IS NOT NULL
	`;

	skyblockItems.clear();

	for (const { id, ...data } of itemUpgradesRows) {
		skyblockItems.set(id, data);
	}
}

void populateCaches();
