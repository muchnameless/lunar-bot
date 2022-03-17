/* eslint-disable unicorn/prefer-top-level-await */
import { exit } from 'node:process';
import { parentPort } from 'node:worker_threads';
import { fetch } from 'undici';
import { transformItemData } from '@zikeji/hypixel';
import { Collection } from 'discord.js';
import postgres from 'postgres';
import { logger } from '../functions/logger';
import { FetchError } from '../structures/errors/FetchError';
import { EnchantmentType, getEnchantmentType } from '../structures/networth/constants/enchantments';
import { calculatePetSkillLevel } from '../structures/networth/functions/pets';
import { MINECRAFT_DATA } from '../constants/minecraft';
import { JobType } from '.';
import type { Components } from '@zikeji/hypixel';

/**
 * 60 per hour (every minute), 24 hours
 */
const MAX_HISTORY_LENGTH = 1_440;

/**
 * display names of vanilla mc items and blocks, including "null"
 */
const VANILLA_ITEM_NAMES = new Set<string>().add('null');

for (const { displayName } of MINECRAFT_DATA.itemsArray) {
	VANILLA_ITEM_NAMES.add(displayName);
}

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
	const [{ median }] = await sql<[{ median: number }]>`
		INSERT INTO prices (
			id,
			history
		) VALUES (
			${itemId},
			ARRAY [${currentPrice}::NUMERIC]
		)
		ON CONFLICT (id)
		DO UPDATE SET history = array_append(prices.history, ${currentPrice})
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
 * fetches bazaar products
 */
async function updateBazaarPrices() {
	const res = await fetch('https://api.hypixel.net/skyblock/bazaar', {
		// @ts-expect-error
		signal: AbortSignal.timeout(30_000),
	});

	if (res.status !== 200) {
		throw new FetchError('FetchBazaarError', res);
	}

	const { products } = (await res.json()) as Components.Schemas.SkyBlockBazaarResponse;

	return Promise.all(
		Object.entries(products).map(([item, data]) =>
			updateItem(
				item,
				data.quick_status.buyPrice < 2_147_483_647 && data.quick_status.buyPrice / data.quick_status.sellPrice < 1e3
					? data.quick_status.buyPrice
					: getBuyPrice(data.buy_summary),
			),
		),
	);
}

/**
 * fetches a single auction page
 * @param page
 */
async function fetchAuctionPage(
	page: number,
): Promise<Pick<Components.Schemas.SkyBlockAuctionsResponse, 'auctions' | 'success' | 'totalPages'>> {
	const res = await fetch(`https://api.hypixel.net/skyblock/auctions?page=${page}`, {
		// @ts-expect-error
		signal: AbortSignal.timeout(30_000),
	});

	if (res.status === 200) return res.json() as Promise<Components.Schemas.SkyBlockAuctionsResponse>;

	// page does not exist -> no-op
	if (res.status === 404) return { success: false, totalPages: -1, auctions: [] };

	// different error -> abort process
	throw new FetchError('FetchAuctionError', res);
}

/**
 * fetches all auction pages
 */
// fetch first auction page
const firstPage = await fetchAuctionPage(0);

// abort on error
if (!firstPage.success) exit(-1);

// update bazaar prices if the first auction page request was successful
const updateBazaarPricesPromise = updateBazaarPrices();

// fetch remaining auction pages
const BINAuctions = new Collection<string, number[]>();
const processAuctions = (auctions: Components.Schemas.SkyBlockAuctionsResponse['auctions']) =>
	Promise.all(
		auctions.map(async (auction) => {
			if (!auction.bin) return;

			const [item] = await transformItemData(auction.item_bytes);

			if (!item) return;

			let itemId = item.tag?.ExtraAttributes?.id;
			let count = item.Count;

			switch (itemId) {
				case 'ENCHANTED_BOOK': {
					const enchants = Object.keys(item.tag!.ExtraAttributes!.enchantments ?? {});

					if (enchants.length !== 1) return;

					const [ENCHANTMENT] = enchants;

					let level = item.tag!.ExtraAttributes!.enchantments[enchants[0]];

					switch (getEnchantmentType(ENCHANTMENT, level)) {
						case EnchantmentType.AnvilUpgradableFrom1:
							count = 2 ** (level - 1);
							level = 1;
							break;

						case EnchantmentType.AnvilUpgradableFrom3:
							count = 2 ** (level - 3);
							level = 3;
							break;

						case EnchantmentType.AnvilUpgradableFrom6:
							count = 2 ** (level - 6);
							level = 6;
							break;

						case EnchantmentType.UsageUpgradable:
							level = 1;
							break;
					}

					itemId = `${ENCHANTMENT}_${level}`;
					break;
				}

				case 'PET': {
					const pet = JSON.parse(item.tag!.ExtraAttributes!.petInfo as string) as Components.Schemas.SkyBlockProfilePet;

					// ignore candied and skinned pets
					if (pet.candyUsed || pet.skin) return;

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

				case undefined:
					// no itemId
					logger.warn(item?.tag?.ExtraAttributes ?? item, '[UPDATE PRICES]: malformed item data');
					return;

				default:
					// ignore vanilla mc items
					if (auction.tier === 'COMMON' && (itemId.includes(':') || VANILLA_ITEM_NAMES.has(auction.item_name))) {
						return;
					}
			}

			const price = auction.starting_bid / count;

			BINAuctions.get(itemId)?.push(price) ?? BINAuctions.set(itemId, [price]);
		}),
	);
const fetchAndProcessAuctions = async (page: number) => processAuctions((await fetchAuctionPage(page)).auctions);

const promises: Promise<void[]>[] = [(() => processAuctions(firstPage.auctions))()];

for (let page = 1; page < firstPage.totalPages; ++page) {
	promises.push(fetchAndProcessAuctions(page));
}

// fetch and process all auction pages
await Promise.all(promises);

// update database and prices map
await Promise.all(BINAuctions.map((auctions, itemId) => updateItem(itemId, Math.min(...auctions))));

// wait for bazaar update to finish
await updateBazaarPricesPromise;

await sql`
  UPDATE prices
  SET history = trim_array(history, array_length(history, 1) - ${MAX_HISTORY_LENGTH})
  WHERE array_length(history, 1) > ${MAX_HISTORY_LENGTH}
`;

await sql.end();

logger.debug(`[SKYBLOCK PRICES]: updated ${BINAuctions.size} items from ${firstPage.totalPages} auction pages`);

if (parentPort) {
	parentPort.postMessage('done');
} else {
	exit(0);
}
