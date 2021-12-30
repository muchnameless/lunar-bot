import { setInterval } from 'node:timers';
import fetch from 'node-fetch';
import { transformItemData } from '@zikeji/hypixel';
import { db } from '../database';
import { minutes, logger } from '../../functions';
import { calculatePetSkillLevel } from './networth';
import type { Components, NBTExtraAttributes } from '@zikeji/hypixel';

export const prices = new Map<string, number>();

/**
 * returns the item's id, with a custom implementation for enchanted books and pets
 * @param item
 */
function getItemId(item: NBTExtraAttributes) {
	if (item.id === 'ENCHANTED_BOOK' && item.enchantments) {
		const enchants = Object.keys(item.enchantments);

		if (enchants.length === 1) {
			const value = item.enchantments[enchants[0]];

			return `${enchants[0]}_${value}`;
		}
	} else if (item.id === 'PET') {
		const pet = JSON.parse(item.petInfo as string) as Components.Schemas.SkyBlockProfilePet;
		const data = calculatePetSkillLevel(pet);

		if (data.level === 1 || data.level === 100 || data.level === 200) {
			return `lvl_${data.level}_${pet.tier}_${pet.type}`;
		}
	}

	return item.id;
}

/**
 * fetches a single auction page
 * @param page
 */
async function fetchAuctionPage(page = 0) {
	const res = await fetch(`https://api.hypixel.net/skyblock/auctions?page=${page}`);

	if (res.status !== 200) throw new Error(res.statusText);

	return res.json() as Promise<Components.Schemas.SkyBlockAuctionsResponse>;
}

/**
 * fetches all auction pages
 */
async function fetchAuctions() {
	try {
		const firstPage = await fetchAuctionPage();

		if (!firstPage.success) return;

		const formattedAuctions = new Map<string, number[]>();
		const processAuctions = (auctions: Components.Schemas.SkyBlockAuctionsResponse['auctions']) =>
			Promise.all(
				auctions.map(async (auction) => {
					if (!auction.bin) return;

					const [item] = await transformItemData(auction.item_bytes);

					if (!item) return;

					const itemId = getItemId(item.tag!.ExtraAttributes!);

					if (formattedAuctions.has(itemId)) {
						formattedAuctions.get(itemId)!.push(auction.starting_bid);
					} else {
						formattedAuctions.set(itemId, [auction.starting_bid]);
					}
				}),
			);

		const promises: Promise<void[]>[] = [(() => processAuctions(firstPage.auctions))()];

		for (let i = 0; i < firstPage.totalPages; ++i) {
			promises.push((async () => processAuctions((await fetchAuctionPage(i)).auctions))());
		}

		await Promise.all(promises);

		for (const [item, auctions] of formattedAuctions) {
			const lowestBIN = Math.min(...auctions);

			prices.set(item.toLowerCase(), lowestBIN);
			db.SkyBlockAuction.upsert({ id: item.toLowerCase(), lowestBIN });
		}
	} catch (error) {
		logger.error(error);
	}
}

/**
 * fetches bazaar products
 */
async function fetchProducts() {
	try {
		const res = await fetch('https://api.hypixel.net/skyblock/bazaar');

		if (res.status !== 200) throw new Error(res.statusText);

		const { products } = (await res.json()) as Components.Schemas.SkyBlockBazaarResponse;

		for (const [item, data] of Object.entries(products)) {
			prices.set(item.toLowerCase(), data.quick_status.buyPrice);
			db.SkyBlockBazaar.upsert({
				id: item.toLowerCase(),
				buyPrice: data.quick_status.buyPrice,
			});
		}
	} catch (error) {
		logger.error(error);
	}
}

// INIT
for (const { id, lowestBIN } of await db.SkyBlockAuction.findAll({
	attributes: ['id', 'lowestBIN'],
	raw: true,
})) {
	prices.set(id, lowestBIN);
}

for (const product of await db.SkyBlockBazaar.findAll()) {
	prices.set(product.id.toLowerCase(), product.buyPrice);
}

setInterval(() => {
	fetchProducts();
	fetchAuctions();
}, minutes(5));
