/* eslint-disable unicorn/prefer-top-level-await */
import { exit } from 'node:process';
import { Buffer } from 'node:buffer';
import { parentPort } from 'node:worker_threads';
import { fetch } from 'undici';
import { Collection } from 'discord.js';
import { parse, simplify } from 'prismarine-nbt';
import postgres from 'postgres';
import { logger } from '../functions/logger';
import { FetchError } from '../structures/errors/FetchError';
import { getEnchantment } from '../structures/networth/constants/enchantments';
import { calculatePetSkillLevel } from '../structures/networth/functions/pets';
import { JobType } from '.';
import type { Components, NBTInventoryItem } from '@zikeji/hypixel';

type SkyBlockAuctionItem = Components.Schemas.SkyBlockAuctionsResponse['auctions'][0];
type SkyBlockAuctionEndedItem = Components.Schemas.SkyBlockAuctionsEndedResponse['auctions'][0];

const sql = postgres({
	types: {
		numeric: {
			// This conversion is identical to the `number` conversion in types.js line 11
			to: 0,
			from: [1_700],
			serialize: (x: number) => x.toString(),
			parse: (x: string) => Number.parseFloat(x),
		},
	},
});

/**
 * updates the database and the prices map with the median of the buy price
 * @param itemId
 * @param currentPrice
 */
async function updateItem(itemId: string, currentPrice: number) {
	// history is a circular buffer with length 1440 (24*60, each minute for 1 day), index points to the next element, $2 is currentPrice
	const [{ median }] = await sql<[{ median: number }]>`
		INSERT INTO prices (
			id,
			history
		) VALUES (
			${itemId},
			ARRAY [${currentPrice}::NUMERIC]
		)
		ON CONFLICT (id) DO
		UPDATE SET
			history[prices.index] = $2,
			index = CASE WHEN prices.index >= 1440 THEN 1
			             ELSE prices.index + 1
			        END
		RETURNING median(history);
	`;

	parentPort?.postMessage({ op: JobType.SkyblockAuctionPriceUpdate, d: { itemId, price: median } });
}

/**
 * https://github.com/SkyCryptWebsite/SkyCrypt/blob/481de4411c4093576c728f04540f497ef55ceadf/src/helper.js#L494
 * calculates the product's buyPrice based on the buy_summary
 * @param orderSummary
 */
function getBuyPrice(orderSummary: Components.Schemas.SkyBlockBazaarProduct['buy_summary']) {
	const _orderSummary = orderSummary.slice(0, Math.ceil(orderSummary.length / 2));
	const totalVolume = _orderSummary.reduce((acc, { amount }) => acc + amount, 0);
	const volumeTop2 = Math.ceil(totalVolume * 0.02);
	const orders: [number, number][] = [];

	let volume = 0;

	for (const order of _orderSummary) {
		const cappedAmount = Math.min(order.amount, volumeTop2 - volume);

		orders.push([order.pricePerUnit, cappedAmount]);

		volume += cappedAmount;

		if (volume >= volumeTop2) {
			break;
		}
	}

	const totalWeight = orders.reduce((acc, [, cur]) => acc + cur, 0);

	return orders.reduce((acc, [a, b]) => acc + (a * b) / totalWeight, 0);
}

/**
 * fetches and processes bazaar products
 */
async function updateBazaarPrices() {
	const res = await fetch('https://api.hypixel.net/skyblock/bazaar', {
		// @ts-expect-error
		signal: AbortSignal.timeout(30_000),
	});

	if (res.status !== 200) {
		throw new FetchError('FetchBazaarError', res);
	}

	const { lastUpdated, products } = (await res.json()) as Components.Schemas.SkyBlockBazaarResponse;

	// check if API data is updated
	const [lastUpdatedEntry] = await sql<[{ value: string }]>`
		SELECT value
		FROM "Config"
		WHERE key = 'HYPIXEL_BAZAAR_LAST_UPDATED'
	`;
	if (lastUpdatedEntry && lastUpdated <= JSON.parse(lastUpdatedEntry.value)) {
		return logger.error({ lastUpdated, lastUpdatedEntry: lastUpdatedEntry.value }, '[UPDATE BAZAAR PRICES]');
	}

	// update database and prices map
	await Promise.all(
		Object.entries(products).map(([item, data]) =>
			updateItem(
				item,
				data.quick_status.buyPrice < 2_147_483_647 && data.quick_status.buyPrice / data.quick_status.sellPrice < 1e3
					? data.quick_status.buyPrice
					: getBuyPrice(data.buy_summary),
			),
		),
	);

	// update config key
	await sql`
		INSERT INTO "Config" (
			key,
			value
		) VALUES (
			'HYPIXEL_BAZAAR_LAST_UPDATED',
			${JSON.stringify(lastUpdated)}
		)
		ON CONFLICT (key) DO
		UPDATE SET value = excluded.value
	`;
}

/**
 * fetches a single auction page
 * @param page
 */
async function fetchAuctionPage(
	page: number,
): Promise<Pick<Components.Schemas.SkyBlockAuctionsResponse, 'auctions' | 'lastUpdated' | 'success' | 'totalPages'>> {
	const res = await fetch(`https://api.hypixel.net/skyblock/auctions?page=${page}`, {
		// @ts-expect-error
		signal: AbortSignal.timeout(30_000),
	});

	if (res.status === 200) return res.json() as Promise<Components.Schemas.SkyBlockAuctionsResponse>;

	// page does not exist -> no-op
	if (res.status === 404) return { success: false, lastUpdated: -1, totalPages: -1, auctions: [] };

	// different error -> abort process
	throw new FetchError('FetchAuctionError', res);
}

const transformItemData = async (data: string): Promise<NBTInventoryItem[]> =>
	simplify((await parse(Buffer.from(data, 'base64'))).parsed.value.i as never);

/**
 * fetches and processes all auction pages
 */
async function updateAuctionPrices() {
	/**
	 * fetches all auction pages
	 */
	// fetch first auction page
	const { success, lastUpdated, totalPages, auctions } = await fetchAuctionPage(0);

	// abort on error
	if (!success) {
		return logger.error(`[UPDATE AUCTION PRICES]: success ${success}`);
	}

	// check if API data is updated
	const [lastUpdatedEntry] = await sql<[{ value: string }]>`
		SELECT value
		FROM "Config"
		WHERE key = 'HYPIXEL_AUCTIONS_LAST_UPDATED'
	`;
	if (lastUpdatedEntry && lastUpdated <= JSON.parse(lastUpdatedEntry.value)) {
		return logger.error({ lastUpdated, lastUpdatedEntry: lastUpdatedEntry.value }, '[UPDATE AUCTION PRICES]');
	}

	// fetch remaining auction pages
	const BINAuctions = new Collection<string, number[]>();
	const processAuction = async (auction: SkyBlockAuctionItem | SkyBlockAuctionEndedItem) => {
		if (!auction.bin && !(auction as SkyBlockAuctionEndedItem).price) return;

		const [item] = await transformItemData(auction.item_bytes);

		if (!item) return;

		let itemId = item.tag?.ExtraAttributes?.id;
		let count = item.Count;

		switch (itemId) {
			case 'ENCHANTED_BOOK': {
				const enchants = Object.keys(item.tag!.ExtraAttributes!.enchantments ?? {});

				if (enchants.length !== 1) return;

				({ itemId, count } = getEnchantment(enchants[0], item.tag!.ExtraAttributes!.enchantments[enchants[0]]));
				break;
			}

			case 'PET': {
				const pet = JSON.parse(item.tag!.ExtraAttributes!.petInfo as string) as Components.Schemas.SkyBlockProfilePet;

				// ignore candied pets
				if (pet.candyUsed) return;

				// ignore skinned pets and pets with items held for lower tiers
				switch (pet.tier) {
					case 'COMMON':
					case 'UNCOMMON':
						if (pet.heldItem) return;
					// fallthrough
					case 'RARE':
					case 'EPIC':
						if (pet.skin) return;
				}

				let { level } = calculatePetSkillLevel(pet);

				if (level < 50) {
					level = 1;
				} else if (level > 100 && level < 150) {
					level = 100;
				}

				if (level !== 1 && level !== 100 && level !== 200) return;

				itemId = `LVL_${level}_${pet.tier}_${pet.type}`;
				break;
			}

			case 'RUNE': {
				const [[RUNE, LEVEL]] = Object.entries(item.tag!.ExtraAttributes!.runes!);

				itemId = `RUNE_${RUNE}_${LEVEL}`;
				break;
			}

			case 'POTION':
				switch (item.tag!.ExtraAttributes!.potion_name) {
					case 'Dungeon': // Dungeon potions
						itemId = `POTION_${item.tag!.ExtraAttributes!.potion_name}_${item.tag!.ExtraAttributes!.potion_level}`;
						break;

					default:
						// ignore other potions with multiple effects
						if (item.tag!.ExtraAttributes!.effects?.length !== 1) return;

						itemId = `POTION_${item.tag!.ExtraAttributes!.potion}_${item.tag!.ExtraAttributes!.potion_level}`;
						break;
				}
				break;

			case undefined: // no itemId
				logger.warn(item?.tag?.ExtraAttributes ?? item, '[UPDATE PRICES]: malformed item data');
				return;

			default:
				// ignore vanilla mc items
				if (
					// common rarity
					((auction as SkyBlockAuctionItem).tier === 'COMMON' || (auction as SkyBlockAuctionItem).tier == undefined) &&
					// no lore (at most one line)
					(item.tag!.display?.Lore?.length ?? 0) <= 1 &&
					// custom skin
					!item.tag!.SkullOwner &&
					// rarity in lore is sometimes different, e.g. EPIC instead of COMMON for SILEX (not SIL_EX)
					item.tag!.display?.Lore?.[0]?.match(/(?<=^(?:§[a-z\d])*)[A-Z]+/)?.[0] === 'COMMON'
				) {
					return;
				}
		}

		const price =
			((auction as SkyBlockAuctionItem).starting_bid ?? (auction as SkyBlockAuctionEndedItem).price) / count;

		BINAuctions.get(itemId)?.push(price) ?? BINAuctions.set(itemId, [price]);
	};
	const processAuctions = (_auctions: (SkyBlockAuctionItem | SkyBlockAuctionEndedItem)[]) =>
		Promise.all(_auctions.map((auction) => processAuction(auction)));
	const fetchAndProcessAuctions = async (page: number) => processAuctions((await fetchAuctionPage(page)).auctions);
	const fetchAndProcessEndedAuctions = async () => {
		const res = await fetch('https://api.hypixel.net/skyblock/auctions_ended', {
			// @ts-expect-error
			signal: AbortSignal.timeout(30_000),
		});

		if (res.status !== 200) throw new FetchError('FetchAuctionError', res);

		return processAuctions(((await res.json()) as Components.Schemas.SkyBlockAuctionsEndedResponse).auctions);
	};

	const promises: Promise<unknown>[] = [processAuctions(auctions), fetchAndProcessEndedAuctions()];

	for (let page = 1; page < totalPages; ++page) {
		promises.push(fetchAndProcessAuctions(page));
	}

	// process all auction pages
	await Promise.all(promises);

	// update database and prices map
	await Promise.all(BINAuctions.map((_auctions, itemId) => updateItem(itemId, Math.min(..._auctions))));

	// update config key
	await sql`
		INSERT INTO "Config" (
			key,
			value
		) VALUES (
			'HYPIXEL_AUCTIONS_LAST_UPDATED',
			${JSON.stringify(lastUpdated)}
		)
		ON CONFLICT (key) DO
		UPDATE SET value = excluded.value
	`;

	logger.debug(`[UPDATE AUCTION PRICES]: updated ${BINAuctions.size} items from ${totalPages} auction pages`);
}

await Promise.all([updateAuctionPrices(), updateBazaarPrices()]);

await sql.end();

if (parentPort) {
	parentPort.postMessage('done');
} else {
	exit(0);
}
