/* eslint-disable unicorn/prefer-top-level-await */
import { exit } from 'node:process';
import { parentPort } from 'node:worker_threads';
import { fetch } from 'undici';
import { Collection } from 'discord.js';
import { XMLParser } from 'fast-xml-parser';
import { logger } from '../functions/logger';
import { FetchError } from '../structures/errors/FetchError';
import {
	calculatePetSkillLevel,
	getEnchantment,
	isVanillaItem,
	transformItemData,
} from '../structures/networth/functions';
import { ItemId } from '../structures/networth/constants/itemId';
import { sql } from '../structures/database/sql';
import { JobType } from '.';
import type { Components } from '@zikeji/hypixel';

/**
 * prices
 */

type SkyBlockAuctionItem = Components.Schemas.SkyBlockAuctionsResponse['auctions'][0];
type SkyBlockAuctionEndedItem = Components.Schemas.SkyBlockAuctionsEndedResponse['auctions'][0];

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

	if (res.status !== 200) throw new FetchError('FetchBazaarError', res);

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
	if (!success) return logger.error(`[UPDATE AUCTION PRICES]: success ${success}`);

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
	const processAuction = async (auction: SkyBlockAuctionItem | SkyBlockAuctionEndedItem, price: number) => {
		const [item] = await transformItemData(auction.item_bytes);

		let itemId = item.tag?.ExtraAttributes?.id;
		let count = item.Count;

		switch (itemId) {
			case ItemId.EnchantedBook: {
				const enchants = Object.keys(item.tag!.ExtraAttributes!.enchantments ?? {});

				if (enchants.length !== 1) return;

				({ itemId, count } = getEnchantment(enchants[0], item.tag!.ExtraAttributes!.enchantments[enchants[0]]));
				break;
			}

			case ItemId.Pet: {
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

			case ItemId.Rune: {
				const [[RUNE, LEVEL]] = Object.entries(item.tag!.ExtraAttributes!.runes!);

				itemId = `RUNE_${RUNE}_${LEVEL}`;
				break;
			}

			case ItemId.Potion:
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
				logger.warn(item, '[UPDATE PRICES]: malformed item data');
				return;

			default:
				// ignore vanilla mc items
				if (isVanillaItem(item)) return;
		}

		BINAuctions.get(itemId)?.push(price / count) ?? BINAuctions.set(itemId, [price / count]);
	};
	const processAuctions = (_auctions: Components.Schemas.SkyBlockAuctionsResponse['auctions']) =>
		Promise.all(_auctions.map((auction) => auction.bin && processAuction(auction, auction.starting_bid)));
	const fetchAndProcessAuctions = async (page: number) => processAuctions((await fetchAuctionPage(page)).auctions);
	const fetchAndProcessEndedAuctions = async () => {
		const res = await fetch('https://api.hypixel.net/skyblock/auctions_ended', {
			// @ts-expect-error
			signal: AbortSignal.timeout(30_000),
		});

		if (res.status !== 200) throw new FetchError('FetchAuctionError', res);

		return Promise.all(
			((await res.json()) as Components.Schemas.SkyBlockAuctionsEndedResponse).auctions.map((auction) =>
				processAuction(auction, auction.price),
			),
		);
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

/**
 * patchnotes
 */

interface HypixelForumResponse {
	rss: {
		channel: {
			title: string;
			description: string;
			pubDate: string;
			lastBuildDate: string;
			generator: string;
			link: string;
			'atom:link': '';
			item: {
				title: string;
				pubDate: string;
				link: string;
				guid: number;
				author: string;
				category: string;
				'dc:creator': string;
				'content:encoded': string;
				'slash:comments': number;
			}[];
		};
	};
}

const xmlParser = new XMLParser({ ignoreDeclaration: true });

/**
 * fetch and parse xml data
 * @param forum
 */
async function fetchForumEntries(forum: string) {
	const res = await fetch(`https://hypixel.net/forums/${forum}/index.rss`, {
		// @ts-expect-error
		signal: AbortSignal.timeout(30_000),
	});

	if (res.status !== 200) throw new FetchError('FetchError', res);

	return (xmlParser.parse(await res.text()) as HypixelForumResponse).rss.channel.item;
}

/**
 * updates skyblock patchnotes from hypixel forum rss feeds
 */
async function updatePatchNotes() {
	// fetch RSS feeds
	const [skyblockPatchnotes, newsAndAnnouncements] = await Promise.all([
		fetchForumEntries('skyblock-patch-notes.158'),
		fetchForumEntries('news-and-announcements.4'),
	]);

	// add skyblock related posts from news and announcements
	for (const item of newsAndAnnouncements) {
		if (item.title.toLowerCase().includes('skyblock') || item['content:encoded'].toLowerCase().includes('skyblock')) {
			skyblockPatchnotes.push(item);
		}
	}

	const now = new Date();
	const parsedItems = skyblockPatchnotes.map(({ guid, title, ['dc:creator']: creator, link }) => ({
		guid,
		title,
		creator,
		link,
		createdAt: now,
		updatedAt: now,
	}));

	const [lastGuidEntry] = await sql<[{ value: string }]>`
		SELECT value
		FROM "Config"
		WHERE key = 'HYPIXEL_FORUM_LAST_GUID'
	`;
	const LAST_GUID: number = lastGuidEntry ? JSON.parse(lastGuidEntry.value) : 0;
	const newPosts = parsedItems.filter(({ guid }) => guid > LAST_GUID);

	await sql`
		INSERT INTO "SkyBlockPatchNotes"
		${sql(parsedItems)}
		ON CONFLICT (guid) DO
		UPDATE SET
			title = excluded.title,
		 	creator = excluded.creator,
		 	link = excluded.link,
		  "updatedAt" = excluded."updatedAt"
	`;

	if (!newPosts.length) return;

	if (parentPort) {
		parentPort.postMessage({
			op: JobType.HypixelForumLastGUIDUpdate,
			d: { HYPIXEL_FORUM_LAST_GUID: Math.max(...newPosts.map(({ guid }) => guid)) },
		});
	} else {
		await sql`
			INSERT INTO "Config" (
				key,
				value
			) VALUES (
				'HYPIXEL_FORUM_LAST_GUID',
				${JSON.stringify(Math.max(...newPosts.map(({ guid }) => guid)))}
			)
			ON CONFLICT (key) DO
			UPDATE SET value = excluded.value
		`;
	}
}

/**
 * run jobs
 */

const errors = (await Promise.allSettled([updateAuctionPrices(), updateBazaarPrices(), updatePatchNotes()])).filter(
	(x) => x.status === 'rejected',
) as PromiseRejectedResult[];

/**
 * cleanup
 */

await sql.end();

if (errors.length) {
	throw errors.map((x) => x.reason);
}

if (parentPort) {
	parentPort.postMessage('done');
} else {
	exit(0);
}
