/* eslint-disable unicorn/prefer-top-level-await */
import { parentPort } from 'node:worker_threads';
import { setTimeout as sleep } from 'node:timers/promises';
import { clearTimeout, setTimeout } from 'node:timers';
import EventEmitter from 'node:events';
import { request } from 'undici';
import { Collection } from 'discord.js';
import { XMLParser } from 'fast-xml-parser';
import { CronJob } from 'cron';
import { logger } from '#logger';
import { FetchError } from '#structures/errors/FetchError';
import { getEnchantment } from '#networth/functions/enchantments'; // separate imports to not import unused files in the worker
import { transformItemData } from '#networth/functions/nbt';
import { calculatePetSkillLevel } from '#networth/functions/pets';
import { ItemId } from '#networth/constants/itemId';
import { ItemRarity } from '#networth/constants/itemRarity';
import { sql } from '#structures/database/sql';
import { consumeBody } from '#root/lib/functions/fetch'; // no index imports to not import unused files in the worker
import { JobType } from '.';
import type { Enchantment } from '#networth/constants/enchantments';
import type { Components } from '@zikeji/hypixel';

// because a single AbortController is used for all fetches
EventEmitter.setMaxListeners(100);

/**
 * prices
 */

type SkyBlockAuctionItem = Components.Schemas.SkyBlockAuctionsResponse['auctions'][0];
type SkyBlockAuctionEndedItem = Components.Schemas.SkyBlockAuctionsEndedResponse['auctions'][0];

const MAX_RETRIES = 3;

/**
 * updates the database and the prices map with the median of the buy price
 * @param itemId
 * @param currentPrice
 */
async function updateItem(itemId: string, currentPrice: number) {
	// history is a circular buffer with length 1440 (24*60, each minute for 1 day), index points to the next element, $2 is currentPrice
	const [{ median, new_entry }] = await sql<[{ median: number; new_entry: boolean }]>`
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
		RETURNING
			median(history),
			array_length(history, 1) = 1 AS new_entry
	`;

	parentPort?.postMessage({ op: JobType.SkyBlockPriceUpdate, d: { itemId, price: median } });

	// eslint-disable-next-line camelcase
	if (new_entry) {
		logger.debug(
			{
				itemId,
				currentPrice,
			},
			'[UPDATE ITEM]: new database entry',
		);
	}
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
async function fetchBazaarPrices(ac: AbortController) {
	const res = await request('https://api.hypixel.net/skyblock/bazaar', { signal: ac.signal });

	if (res.statusCode === 200) return res.body.json() as Promise<Components.Schemas.SkyBlockBazaarResponse>;

	void consumeBody(res);
	throw new FetchError('FetchBazaarError', res);
}

/**
 * fetches and processes bazaar products
 */
async function updateBazaarPrices(ac: AbortController) {
	let { lastUpdated, products } = await fetchBazaarPrices(ac);

	// check if API data is updated
	const [lastUpdatedEntry] = await sql<[{ value: string }]>`
		SELECT value
		FROM "Config"
		WHERE key = 'HYPIXEL_BAZAAR_LAST_UPDATED'
	`;

	if (lastUpdatedEntry) {
		const lastUpdatedEntryParsed: number = JSON.parse(lastUpdatedEntry.value);

		let retries = 0;

		while (lastUpdated <= lastUpdatedEntryParsed) {
			if (++retries > MAX_RETRIES) {
				logger.error({ lastUpdated, lastUpdatedEntry: lastUpdatedEntryParsed }, '[UPDATE BAZAAR PRICES]');
				return [];
			}

			logger.warn(`[UPDATE BAZAAR PRICES]: refetching Bazaar: ${lastUpdatedEntryParsed} <> ${lastUpdated}`);
			await sleep(5_000);

			// fetch first auction page
			({ lastUpdated, products } = await fetchBazaarPrices(ac));
		}
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

	return Object.keys(products);
}

/**
 * fetches a single auction page
 * @param page
 */
async function fetchAuctionPage(
	ac: AbortController,
	page: number,
): Promise<Pick<Components.Schemas.SkyBlockAuctionsResponse, 'auctions' | 'lastUpdated' | 'success' | 'totalPages'>> {
	const res = await request(`https://api.hypixel.net/skyblock/auctions?page=${page}`, { signal: ac.signal });

	if (res.statusCode === 200) return res.body.json() as Promise<Components.Schemas.SkyBlockAuctionsResponse>;

	void consumeBody(res);

	// page does not exist -> no-op
	if (res.statusCode === 404) return { success: false, lastUpdated: -1, totalPages: -1, auctions: [] };

	// different error -> abort process
	throw new FetchError('FetchAuctionError', res);
}

/**
 * fetches and processes all auction pages
 */
async function updateAuctionPrices(ac: AbortController) {
	/**
	 * fetches all auction pages
	 */
	// fetch first auction page
	let { success, lastUpdated, totalPages, auctions } = await fetchAuctionPage(ac, 0);

	const binAuctions = new Collection<string, number[]>();

	// abort on error
	if (!success) {
		logger.error(`[UPDATE AUCTION PRICES]: success ${success}`);
		return binAuctions;
	}

	// check if API data is updated
	const [lastUpdatedEntry] = await sql<[{ value: string }]>`
		SELECT value
		FROM "Config"
		WHERE key = 'HYPIXEL_AUCTIONS_LAST_UPDATED'
	`;

	if (lastUpdatedEntry) {
		const lastUpdatedEntryParsed: number = JSON.parse(lastUpdatedEntry.value);

		let retries = 0;

		while (lastUpdated <= lastUpdatedEntryParsed) {
			if (++retries > MAX_RETRIES) {
				logger.error({ lastUpdated, lastUpdatedEntry: lastUpdatedEntryParsed }, '[UPDATE AUCTION PRICES]');
				return binAuctions;
			}

			logger.warn(
				`[UPDATE AUCTION PRICES]: refetching page 0/${totalPages}: ${lastUpdatedEntryParsed} <> ${lastUpdated}`,
			);
			await sleep(5_000);

			// fetch first auction page
			({ success, lastUpdated, totalPages, auctions } = await fetchAuctionPage(ac, 0));

			// abort on error
			if (!success) {
				logger.error(`[UPDATE AUCTION PRICES]: success ${success}`);
				return binAuctions;
			}
		}
	}

	// fetch remaining auction pages
	const processAuction = async (auction: SkyBlockAuctionItem | SkyBlockAuctionEndedItem, price: number) => {
		const [item] = await transformItemData(auction.item_bytes);

		let itemId = item.tag?.ExtraAttributes?.id;
		let count = item.Count;

		switch (itemId) {
			case ItemId.EnchantedBook: {
				const enchants = Object.keys(item.tag!.ExtraAttributes!.enchantments ?? {});

				// ignore books with multiple enchantments
				if (enchants.length !== 1) return;

				({ itemId, count } = getEnchantment(
					enchants[0] as Enchantment,
					item.tag!.ExtraAttributes!.enchantments[enchants[0]!]!,
				));
				break;
			}

			case ItemId.Pet: {
				const pet = JSON.parse(item.tag!.ExtraAttributes!.petInfo as string) as Components.Schemas.SkyBlockProfilePet;

				// ignore candied pets
				if (pet.candyUsed) return;

				// ignore skinned pets and pets with items held for lower tiers
				switch (pet.tier) {
					case ItemRarity.Common:
					case ItemRarity.Uncommon:
						if (pet.heldItem) return;
					// fallthrough
					case ItemRarity.Rare:
					case ItemRarity.Epic:
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
				const [RUNE, LEVEL] = Object.entries(item.tag!.ExtraAttributes!.runes!)[0]!;

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
				logger.warn({ auction, item }, '[UPDATE PRICES]: malformed item data');
				return;
		}

		binAuctions.get(itemId)?.push(price / count) ?? binAuctions.set(itemId, [price / count]);
	};

	const processAuctions = (_auctions: Components.Schemas.SkyBlockAuctionsResponse['auctions']) =>
		Promise.all(_auctions.map((auction) => auction.bin && processAuction(auction, auction.starting_bid)));

	let retries = 0;

	const fetchAndProcessAuctions = async (page: number): Promise<unknown> => {
		const { auctions: _auctions, lastUpdated: _lastUpdated } = await fetchAuctionPage(ac, page);

		if (_lastUpdated !== lastUpdated) {
			if (_lastUpdated < lastUpdated && ++retries <= MAX_RETRIES) {
				logger.warn(`[FETCH AUCTIONS]: refetching page ${page}/${totalPages}: ${lastUpdated} <> ${_lastUpdated}`);
				await sleep(5_000);

				return fetchAndProcessAuctions(page);
			}

			logger.error(
				`[FETCH AUCTIONS]: page ${page}/${totalPages}'s lastUpdated does not match: ${lastUpdated} <> ${_lastUpdated}`,
			);
		}

		return processAuctions(_auctions);
	};

	const fetchAndProcessEndedAuctions = async () => {
		const res = await request('https://api.hypixel.net/skyblock/auctions_ended', { signal: ac.signal });

		if (res.statusCode === 200) {
			return Promise.all(
				((await res.body.json()) as Components.Schemas.SkyBlockAuctionsEndedResponse).auctions.map((auction) =>
					processAuction(auction, auction.price),
				),
			);
		}

		void consumeBody(res);
		throw new FetchError('FetchAuctionError', res);
	};

	const promises: Promise<unknown>[] = [processAuctions(auctions), fetchAndProcessEndedAuctions()];

	for (let page = 1; page < totalPages; ++page) {
		promises.push(fetchAndProcessAuctions(page));
	}

	// process all auction pages
	await Promise.all(promises);

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

	logger.debug(`[UPDATE AUCTION PRICES]: updated ${binAuctions.size} items from ${totalPages} auction pages`);

	// return auctions to update db
	return binAuctions;
}

/**
 * update auction and bazaar prices
 * @param ac
 */
async function updatePrices(ac: AbortController) {
	const [binAuctions, bazaarItems] = await Promise.all([updateAuctionPrices(ac), updateBazaarPrices(ac)]);

	// remove auctioned items that are available in the bazaar
	for (const itemId of bazaarItems) {
		binAuctions.delete(itemId);
	}

	return Promise.all(binAuctions.map((_auctions, itemId) => updateItem(itemId, Math.min(..._auctions))));
}

interface SkyBlockItem {
	material: string;
	durability: number;
	skin: string;
	name: string;
	category: string;
	stats?: Record<string, number>;
	soulbound?: 'COOP' | 'SOLO';
	tier: 'RARE';
	npc_sell_price: number;
	dungeon_item_conversion_cost?: EssenceUpgrade;
	upgrade_costs?: (EssenceUpgrade | ItemUpgrade)[][];
	id: string;
	prestige?: {
		item_id: string;
		costs: (EssenceUpgrade | ItemUpgrade)[];
	};
}

interface Upgrade {
	amount: number;
}

interface EssenceUpgrade extends Upgrade {
	essence_type: string;
}

interface ItemUpgrade extends Upgrade {
	item_id: string;
}

interface Prestige {
	item: string;
	costs: Record<string, number>;
}

export type ParsedSkyBlockItem = {
	id: string;
	dungeon_conversion: Record<string, number> | null;
	stars: Record<string, number>[] | null;
	category: string | null;
	prestige: Prestige | null;
};

const reduceCostsArray = (costs: (EssenceUpgrade | ItemUpgrade)[]) =>
	costs.reduce((acc, cur) => {
		acc[(cur as EssenceUpgrade).essence_type ?? (cur as ItemUpgrade).item_id] = cur.amount;
		return acc;
	}, {} as Record<string, number>);

/**
 * update skyblock items
 * @param ac
 */
async function updateSkyBlockItems(ac: AbortController) {
	const res = await request('https://api.hypixel.net/resources/skyblock/items', { signal: ac.signal });

	if (res.statusCode !== 200) {
		void consumeBody(res);
		throw new FetchError('FetchBazaarError', res);
	}

	const { success, items } = (await res.body.json()) as { success: boolean; items: SkyBlockItem[] };

	if (!success) return;

	const parsedItems: ParsedSkyBlockItem[] = items.map((item) => ({
		id: item.id,
		dungeon_conversion: item.dungeon_item_conversion_cost
			? { [item.dungeon_item_conversion_cost.essence_type]: item.dungeon_item_conversion_cost.amount }
			: null,
		stars: item.upgrade_costs?.map((entry) => reduceCostsArray(entry)) ?? null,
		category: item.category ?? null,
		prestige: null,
	}));

	for (const { id, prestige } of items) {
		if (!prestige) continue;

		const item = parsedItems.find(({ id: _id }) => _id === prestige.item_id);
		if (!item) continue;

		item.prestige = { item: id, costs: reduceCostsArray(prestige.costs) };
	}

	await sql`
		INSERT INTO skyblock_items
		${sql(parsedItems)}
		ON CONFLICT (id) DO
		UPDATE SET
			dungeon_conversion = excluded.dungeon_conversion,
			stars = excluded.stars,
			category = excluded.category,
			prestige = excluded.prestige
	`;

	parentPort?.postMessage({ op: JobType.SkyBlockItemUpdate, d: parsedItems });

	logger.debug(`[UPDATE SKYBLOCK ITEMS]: updated ${parsedItems.length} items`);
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
async function fetchForumEntries(ac: AbortController, forum: string) {
	const res = await request(`https://hypixel.net/forums/${forum}/index.rss`, { signal: ac.signal });

	if (res.statusCode === 200) return (xmlParser.parse(await res.body.text()) as HypixelForumResponse).rss.channel.item;

	void consumeBody(res);
	throw new FetchError('FetchError', res);
}

/**
 * updates skyblock patchnotes from hypixel forum rss feeds
 */
let lastGuid: number = JSON.parse(
	(
		await sql<[{ value: string }]>`
			SELECT value FROM "Config" WHERE key = 'HYPIXEL_FORUM_LAST_GUID'
		`
	)[0]?.value,
);

async function updatePatchNotes(ac: AbortController) {
	// fetch RSS feeds
	const [skyblockPatchnotes, newsAndAnnouncements] = await Promise.all([
		fetchForumEntries(ac, 'skyblock-patch-notes.158'),
		fetchForumEntries(ac, 'news-and-announcements.4'),
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

	const newPosts = parsedItems.filter(({ guid }) => guid > lastGuid);

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

	lastGuid = Math.max(...newPosts.map(({ guid }) => guid));

	if (parentPort) {
		parentPort.postMessage({
			op: JobType.HypixelForumLastGUIDUpdate,
			d: lastGuid,
		});
	} else {
		await sql`
			INSERT INTO "Config" (
				key,
				value
			) VALUES (
				'HYPIXEL_FORUM_LAST_GUID',
				${JSON.stringify(lastGuid)}
			)
			ON CONFLICT (key) DO
			UPDATE SET value = excluded.value
		`;
	}

	logger.debug(`[UPDATE PATCH NOTES]: new forum entry with guid '${lastGuid}'`);
}

/**
 * manual jobs
 */
parentPort?.on('message', async (message) => {
	if (message === updateSkyBlockItems.name) {
		const ac = new AbortController();
		const timeout = setTimeout(() => ac.abort(), 60_000);

		try {
			await updateSkyBlockItems(ac);
			clearTimeout(timeout);
		} catch (error) {
			logger.error(error);
		}
	}
});

/**
 * automatic jobs
 */
let ac: AbortController | null = null;

async function runJobs() {
	logger.debug('[WORKER]: running jobs');

	if (ac) {
		logger.error('[WORKER]: aborting current jobs');
		ac.abort();
	}

	ac = new AbortController();

	const jobs = [updatePrices(ac), updatePatchNotes(ac)];

	// every full hour
	if (new Date().getMinutes() === 0) {
		jobs.push(updateSkyBlockItems(ac));
	}

	for (const res of await Promise.allSettled(jobs)) {
		if (res.status === 'rejected') {
			logger.error(res.reason);
		}
	}

	ac = null;
}

new CronJob('*/1 * * * *', runJobs).start();
