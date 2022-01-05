import { setInterval } from 'node:timers';
import fetch from 'node-fetch';
import { transformItemData } from '@zikeji/hypixel';
import { col, fn } from 'sequelize';
import { db } from '../database';
import { minutes, logger } from '../../functions';
import { FetchError } from '../errors/FetchError';
import { calculatePetSkillLevel } from './networth';
import { MAX_HISTORY_LENGTH } from './constants';
import type { Components } from '@zikeji/hypixel';

export const prices = new Map<string, number>();
export const getPrice = (item: string) => prices.get(item) ?? 0;

/**
 * fetches a single auction page
 * @param page
 */
async function fetchAuctionPage(page = 0) {
	const res = await fetch(`https://api.hypixel.net/skyblock/auctions?page=${page}`);

	if (res.status !== 200) throw new FetchError('FetchAuctionError', res);

	return res.json() as Promise<Components.Schemas.SkyBlockAuctionsResponse>;
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

			prices.set(itemId, buyPrice);

			await db.SkyBlockBazaar.update(
				{ buyPrice, buyPriceHistory: fn('array_prepend', currentBuyPrice, col('buyPriceHistory')) },
				{ where: { id: itemId } },
			);

			if (existing.buyPriceHistory.length > MAX_HISTORY_LENGTH) {
				await db.SkyBlockBazaar.update(
					{
						buyPriceHistory: fn(
							'array_trim',
							col('buyPriceHistory'),
							existing.buyPriceHistory.length - MAX_HISTORY_LENGTH,
						),
					},
					{ where: { id: itemId } },
				);
			}
		} else {
			prices.set(itemId, currentBuyPrice);

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

		if (res.status !== 200) throw new FetchError('FetchBazaarError', res);

		const { products } = (await res.json()) as Components.Schemas.SkyBlockBazaarResponse;

		for (const [item, data] of Object.entries(products)) {
			updateBazaarItem(item, data.quick_status.buyPrice);
		}
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

			prices.set(itemId, lowestBIN);

			await db.SkyBlockAuction.update(
				{ lowestBIN, lowestBINHistory: fn('array_prepend', currentLowestBIN, col('lowestBINHistory')) },
				{ where: { id: itemId } },
			);

			if (existing.lowestBINHistory.length > MAX_HISTORY_LENGTH) {
				await db.SkyBlockAuction.update(
					{
						lowestBINHistory: fn(
							'array_trim',
							col('lowestBINHistory'),
							existing.lowestBINHistory.length - MAX_HISTORY_LENGTH,
						),
					},
					{ where: { id: itemId } },
				);
			}
		} else {
			prices.set(itemId, currentLowestBIN);

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
 * fetches all auction pages
 */
async function updatePrices() {
	try {
		// fetch first auction page
		const firstPage = await fetchAuctionPage();

		// abort on error
		if (!firstPage.success) return logger.error('[UPDATE PRICES]: firstPage not successful');

		// update bazaar prices if the first auction page request was successful
		updateBazaarPrices();

		// fetch remaining auction pages
		const BINAuctions = new Map<string, number[]>();
		const processAuctions = (auctions: Components.Schemas.SkyBlockAuctionsResponse['auctions']) =>
			Promise.all(
				auctions.map(async (auction) => {
					if (!auction.bin) return;

					const [item] = await transformItemData(auction.item_bytes);

					if (!item) return;

					let itemId = item.tag?.ExtraAttributes?.id;

					switch (itemId) {
						case 'ENCHANTED_BOOK': {
							const enchants = Object.keys(item.tag!.ExtraAttributes!.enchantments ?? {});

							if (enchants.length !== 1) return;

							itemId = `${enchants[0]}_${item.tag!.ExtraAttributes!.enchantments[enchants[0]]}`;
							break;
						}

						case 'PET': {
							const pet = JSON.parse(
								item.tag!.ExtraAttributes!.petInfo as string,
							) as Components.Schemas.SkyBlockProfilePet;

							// ignore candied pets
							if (pet.candyUsed) return;

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

						case undefined:
							logger.warn(item?.tag?.ExtraAttributes ?? item, '[UPDATE PRICES]: malformed item data');
							return;
					}

					BINAuctions.get(itemId)?.push(auction.starting_bid) ?? BINAuctions.set(itemId, [auction.starting_bid]);
				}),
			);

		const promises: Promise<void[]>[] = [(() => processAuctions(firstPage.auctions))()];

		for (let i = 0; i < firstPage.totalPages; ++i) {
			promises.push((async () => processAuctions((await fetchAuctionPage(i)).auctions))());
		}

		await Promise.all(promises);

		for (const [itemId, auctions] of BINAuctions) {
			updateAuctionItem(itemId, Math.min(...auctions));
		}

		logger.debug(`[UPDATE PRICES]: updated ${BINAuctions.size} items from ${firstPage.totalPages} auction pages`);
	} catch (error) {
		logger.error(error, '[UPDATE PRICES]');
	}
}

// INIT
for (const { id, lowestBIN } of await db.SkyBlockAuction.findAll({ attributes: ['id', 'lowestBIN'], raw: true })) {
	prices.set(id, lowestBIN);
}

for (const { id, buyPrice } of await db.SkyBlockBazaar.findAll({ attributes: ['id', 'buyPrice'], raw: true })) {
	prices.set(id, buyPrice);
}

setInterval(updatePrices, minutes(5));
