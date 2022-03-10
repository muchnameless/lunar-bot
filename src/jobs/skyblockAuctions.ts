/* eslint-disable unicorn/prefer-top-level-await */
import { exit } from 'node:process';
import { parentPort } from 'node:worker_threads';
import { fetch } from 'undici';
import { transformItemData } from '@zikeji/hypixel';
import { col, fn } from 'sequelize';
import { Collection } from 'discord.js';
import { db } from '../structures/database';
import { consumeBody, logger } from '../functions';
import { FetchError } from '../structures/errors/FetchError';
import { VANILLA_ITEM_NAMES } from '../constants';
import { calculatePetSkillLevel } from '../structures/networth/networth';
import { EnchantmentType, getEnchantmentType, MAX_HISTORY_LENGTH } from '../structures/networth/constants';
import { JobType } from '.';
import type { Components } from '@zikeji/hypixel';

export interface ItemPrice {
	itemId: string;
	price: number;
}

const itemPrices: ItemPrice[] = [];

/**
 * https://github.com/SkyCryptWebsite/SkyCrypt/blob/481de4411c4093576c728f04540f497ef55ceadf/src/helper.js#L494
 * calculates the product's buyPrice based on the buy_summary
 * @param orderSummary
 */
function getBuyPrice(orderSummary: Components.Schemas.SkyBlockBazaarProduct['buy_summary']) {
	const _orderSummary = orderSummary.slice(0, Math.ceil(orderSummary.length / 2));

	const orders = [];

	const totalVolume = _orderSummary.map((a) => a.amount).reduce((a, b) => a + b, 0);
	const volumeTop2 = Math.ceil(totalVolume * 0.02);

	let volume = 0;

	for (const order of _orderSummary) {
		const cappedAmount = Math.min(order.amount, volumeTop2 - volume);

		orders.push([order.pricePerUnit, cappedAmount]);

		volume += cappedAmount;

		if (volume >= volumeTop2) {
			break;
		}
	}

	const totalWeight = orders.reduce((sum, value) => sum + value[1], 0);

	return orders.reduce((mean, value) => mean + (value[0] * value[1]) / totalWeight, 0);
}

/**
 * updates the database and the prices map with the median of the buy price
 * @param itemId
 * @param currentBuyPrice
 */
async function updateBazaarItem(itemId: string, currentBuyPrice: number) {
	try {
		const existing = await db.SkyBlockBazaar.findByPk(itemId, { attributes: ['buyPriceHistory'], raw: true });

		if (existing) {
			// calculate median value
			existing.buyPriceHistory.push(currentBuyPrice);
			const buyPrice = existing.buyPriceHistory.sort((a, b) => a - b).at(existing.buyPriceHistory.length / 2)!;

			itemPrices.push({ itemId, price: buyPrice });

			await db.SkyBlockBazaar.update(
				{ buyPrice, buyPriceHistory: fn('array_prepend', currentBuyPrice, col('buyPriceHistory')) },
				{ where: { id: itemId } },
			);

			if (existing.buyPriceHistory.length > MAX_HISTORY_LENGTH) {
				await db.SkyBlockBazaar.update(
					{
						buyPriceHistory: fn(
							'trim_array',
							col('buyPriceHistory'),
							existing.buyPriceHistory.length - MAX_HISTORY_LENGTH,
						),
					},
					{ where: { id: itemId } },
				);
			}
		} else {
			itemPrices.push({ itemId, price: currentBuyPrice });

			await db.SkyBlockBazaar.create({
				id: itemId,
				buyPrice: currentBuyPrice,
				buyPriceHistory: [currentBuyPrice],
			});

			logger.debug(
				{
					itemId,
					currentBuyPrice,
				},
				'[UPDATE BAZAAR ITEM]: new database entry',
			);
		}
	} catch (error) {
		logger.error({ err: error, data: { itemId, currentBuyPrice } }, '[UPDATE BAZAAR ITEM]');
	}
}

/**
 * fetches bazaar products
 */
async function updateBazaarPrices() {
	try {
		const res = await fetch('https://api.hypixel.net/skyblock/bazaar');

		if (res.status !== 200) {
			consumeBody(res);
			throw new FetchError('FetchBazaarError', res);
		}

		const { products } = (await res.json()) as Components.Schemas.SkyBlockBazaarResponse;

		return Promise.all(
			Object.entries(products).map(([item, data]) =>
				updateBazaarItem(
					item,
					data.quick_status.buyPrice < 2_147_483_647 && data.quick_status.buyPrice / data.quick_status.sellPrice < 1e3
						? data.quick_status.buyPrice
						: getBuyPrice(data.buy_summary),
				),
			),
		);
	} catch (error) {
		logger.error(error, '[UPDATE BAZAAR PRICES]');
	}
}

/**
 * updates the database and the prices map with the median of the lowest BIN
 * @param itemId
 * @param currentLowestBIN
 */
async function updateAuctionItem(itemId: string, currentLowestBIN: number) {
	try {
		const existing = await db.SkyBlockAuction.findByPk(itemId, { attributes: ['lowestBINHistory'], raw: true });

		if (existing) {
			// calculate median value
			existing.lowestBINHistory.push(currentLowestBIN);
			const lowestBIN = existing.lowestBINHistory.sort((a, b) => a - b).at(existing.lowestBINHistory.length / 2)!;

			itemPrices.push({ itemId, price: lowestBIN });

			await db.SkyBlockAuction.update(
				{ lowestBIN, lowestBINHistory: fn('array_prepend', currentLowestBIN, col('lowestBINHistory')) },
				{ where: { id: itemId } },
			);

			if (existing.lowestBINHistory.length > MAX_HISTORY_LENGTH) {
				await db.SkyBlockAuction.update(
					{
						lowestBINHistory: fn(
							'trim_array',
							col('lowestBINHistory'),
							existing.lowestBINHistory.length - MAX_HISTORY_LENGTH,
						),
					},
					{ where: { id: itemId } },
				);
			}
		} else {
			itemPrices.push({ itemId, price: currentLowestBIN });

			await db.SkyBlockAuction.create({
				id: itemId,
				lowestBIN: currentLowestBIN,
				lowestBINHistory: [currentLowestBIN],
			});

			logger.debug(
				{
					itemId,
					currentLowestBIN,
				},
				'[UPDATE AUCTION ITEM]: new database entry',
			);
		}
	} catch (error) {
		logger.error({ err: error, data: { itemId, currentLowestBIN } }, '[UPDATE AUCTION ITEM]');
	}
}

/**
 * fetches a single auction page
 * @param page
 */
async function fetchAuctionPage(page = 0) {
	const res = await fetch(`https://api.hypixel.net/skyblock/auctions?page=${page}`);

	if (res.status !== 200) {
		consumeBody(res);
		throw new FetchError('FetchAuctionError', res);
	}

	return res.json() as Promise<Components.Schemas.SkyBlockAuctionsResponse>;
}

/**
 * fetches all auction pages
 */
// fetch first auction page
const firstPage = await fetchAuctionPage();

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

const promises: Promise<void[]>[] = [(() => processAuctions(firstPage.auctions))()];

for (let i = 0; i < firstPage.totalPages; ++i) {
	promises.push((async () => processAuctions((await fetchAuctionPage(i)).auctions))());
}

await Promise.all(promises);
await Promise.all(BINAuctions.map((auctions, itemId) => updateAuctionItem(itemId, Math.min(...auctions))));
await updateBazaarPricesPromise;

if (parentPort) {
	parentPort.postMessage({
		op: JobType.SkyblockAuctionPriceUpdate,
		d: { itemPrices, totalPages: firstPage.totalPages },
	});
	parentPort.postMessage('done');
} else {
	exit(0);
}
