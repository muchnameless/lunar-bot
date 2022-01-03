import { setInterval } from 'node:timers';
import fetch from 'node-fetch';
import { transformItemData } from '@zikeji/hypixel';
import { db } from '../database';
import { minutes, logger } from '../../functions';
import { FetchError } from '../errors/FetchError';
import { calculatePetSkillLevel } from './networth';
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
			const lowestBIN = Math.min(...auctions);

			prices.set(itemId, lowestBIN);
			db.SkyBlockAuction.upsert({ id: itemId, lowestBIN });
		}

		logger.debug(`[UPDATE PRICES]: updated ${BINAuctions.size} items from ${firstPage.totalPages} auction pages`);
	} catch (error) {
		logger.error(error, '[UPDATE PRICES]');
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
			prices.set(item, data.quick_status.buyPrice);
			db.SkyBlockBazaar.upsert({
				id: item,
				buyPrice: data.quick_status.buyPrice,
			});
		}
	} catch (error) {
		logger.error(error, '[UPDATE BAZAAR PRICES]');
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
