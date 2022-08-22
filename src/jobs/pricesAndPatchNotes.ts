/* eslint-disable unicorn/prefer-top-level-await */
import { parentPort } from 'node:worker_threads';
import { setTimeout as sleep } from 'node:timers/promises';
import { clearTimeout, setTimeout } from 'node:timers';
import { EventEmitter } from 'node:events';
import { request } from 'undici';
import { Collection } from 'discord.js';
import { XMLParser } from 'fast-xml-parser';
import { CronJob } from 'cron';
import { Client } from '@zikeji/hypixel';
import { logger } from '#logger';
import { FetchError } from '#structures/errors/FetchError';
import { getEnchantment } from '#networth/functions/enchantments'; // separate imports to not import unused files in the worker
import { transformItemData } from '#networth/functions/nbt';
import { calculatePetSkillLevel } from '#networth/functions/pets';
import { ItemId } from '#networth/constants/itemId';
import { ItemRarity } from '#networth/constants/itemRarity';
import { sql } from '#structures/database/sql';
import { JobType } from '.';
import type { ArrayElementType } from '@sapphire/utilities';
import type { Components } from '@zikeji/hypixel';
import type { Enchantment } from '#networth/constants/enchantments';

// because a single AbortController is used for all fetches
EventEmitter.setMaxListeners(100);

const hypixel = new Client('unused key', { retries: 1 });

/**
 * prices
 */

type SkyBlockAuctionItem = ArrayElementType<Components.Schemas.SkyBlockAuctionsResponse['auctions']>;
type SkyBlockAuctionEndedItem = ArrayElementType<Components.Schemas.SkyBlockAuctionsEndedResponse['auctions']>;

const MAX_RETRIES = 5;

/**
 * upserts an item
 * @param itemId
 * @param currentPrice
 */
async function upsertItem(itemId: string, currentPrice: number) {
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
			'[UPSERT ITEM]: new database entry',
		);
	}
}

/**
 * inserts an item, ignoring already existing ones
 * @param itemId
 * @param currentPrice
 */
async function insertItem(itemId: string, currentPrice: number) {
	// history is a circular buffer with length 1440 (24*60, each minute for 1 day), index points to the next element, $2 is currentPrice
	const [res] = await sql<{ median: number; new_entry: boolean }[]>`
		INSERT INTO prices (
			id,
			history
		) VALUES (
			${itemId},
			ARRAY [${currentPrice}::NUMERIC]
		)
		ON CONFLICT (id) DO NOTHING
		RETURNING
			median(history),
			array_length(history, 1) = 1 AS new_entry
	`;

	// item already exists
	if (!res) return;

	parentPort?.postMessage({ op: JobType.SkyBlockPriceUpdate, d: { itemId, price: res.median } });

	if (res.new_entry) {
		logger.debug(
			{
				itemId,
				currentPrice,
			},
			'[INSERT ITEM]: new database entry',
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
 * fetches and processes bazaar products
 */
async function updateBazaarPrices(binAuctions: Collection<string, number[]>, ac: AbortController) {
	let { lastUpdated, products } = await hypixel.skyblock.bazaar({ signal: ac.signal });

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
				logger.error(
					{ previous: lastUpdatedEntryParsed, current: lastUpdated },
					'[UPDATE BAZAAR PRICES]: max retries reached',
				);
				return [];
			}

			logger.warn({ previous: lastUpdatedEntryParsed, current: lastUpdated }, '[UPDATE BAZAAR PRICES]: refetching');
			await sleep(5_000);

			// refetch bazaar products
			({ lastUpdated, products } = await hypixel.skyblock.bazaar({ signal: ac.signal }));
		}
	}

	const bazaarItems = Object.values(products);

	// update database and prices map
	await Promise.all(
		bazaarItems.map((data) => {
			const price =
				data.quick_status.buyPrice < 2_147_483_647 && data.quick_status.buyPrice / data.quick_status.sellPrice < 1e3
					? data.quick_status.buyPrice
					: getBuyPrice(data.buy_summary);

			if (data.product_id.startsWith('ENCHANTMENT_')) {
				const lastUnderscore = data.product_id.lastIndexOf('_');
				const { itemId, count } = getEnchantment(
					data.product_id.slice('ENCHANTMENT_'.length, lastUnderscore).toLowerCase() as Enchantment,
					Number(data.product_id.slice(lastUnderscore + 1)),
				);

				binAuctions.ensure(itemId, () => []).push(price / count);
			}

			return upsertItem(data.product_id, price);
		}),
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

	return bazaarItems;
}

/**
 * fetches and processes all auction pages
 */
async function updateAuctionPrices(binAuctions: Collection<string, number[]>, ac: AbortController) {
	/**
	 * fetches all auction pages
	 */
	// fetch first auction page
	let { success, lastUpdated, totalPages, auctions } = await hypixel.skyblock.auctions.page(0, { signal: ac.signal });

	let endedAuctions = 0;

	// abort on error
	if (!success) {
		logger.error({ success }, '[UPDATE AUCTION PRICES]');
		return { endedAuctions, totalPages };
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
				logger.error(
					{
						previous: lastUpdatedEntryParsed,
						current: lastUpdated,
						page: 0,
						totalPages,
					},
					'[UPDATE AUCTION PRICES]: max retries reached',
				);
				return { endedAuctions, totalPages };
			}

			logger.warn(
				{
					previous: lastUpdatedEntryParsed,
					current: lastUpdated,
					page: 0,
					totalPages,
				},
				'[UPDATE AUCTION PRICES]: refetching',
			);
			await sleep(5_000);

			// fetch first auction page
			({ success, lastUpdated, totalPages, auctions } = await hypixel.skyblock.auctions.page(0, { signal: ac.signal }));

			// abort on error
			if (!success) {
				logger.error({ success }, '[UPDATE AUCTION PRICES]');
				return { endedAuctions, totalPages };
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

		binAuctions.ensure(itemId, () => []).push(price / count);
	};

	const processAuctions = (_auctions: Components.Schemas.SkyBlockAuctionsResponse['auctions']) =>
		Promise.all(_auctions.map((auction) => auction.bin && processAuction(auction, auction.starting_bid)));

	let retries = 0;

	const fetchAndProcessAuctions = async (page: number): Promise<unknown> => {
		const { auctions: _auctions, lastUpdated: _lastUpdated } = await hypixel.skyblock.auctions.page(page, {
			signal: ac.signal,
		});

		if (_lastUpdated < lastUpdated) {
			if (++retries <= MAX_RETRIES) {
				logger.warn(
					{
						previous: lastUpdated,
						current: _lastUpdated,
						page,
						totalPages,
					},
					'[UPDATE AUCTION PRICES]: refetching',
				);
				await sleep(5_000);

				return fetchAndProcessAuctions(page);
			}

			logger.error(
				{
					previous: lastUpdated,
					current: _lastUpdated,
					page,
					totalPages,
				},
				'[UPDATE AUCTION PRICES]: max retries reached',
			);
		}

		return processAuctions(_auctions);
	};

	const fetchAndProcessEndedAuctions = async () => {
		const { auctions: _auctions } = await hypixel.skyblock.auctionsEnded({ signal: ac.signal });

		endedAuctions = _auctions.length;
		return Promise.all(_auctions.map((auction) => processAuction(auction, auction.price)));
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

	// return auctions to update db
	return { endedAuctions, totalPages };
}

/**
 * update auction and bazaar prices
 * @param ac
 */
async function updatePrices(ac: AbortController) {
	const binAuctions = new Collection<string, number[]>();

	const [{ endedAuctions, totalPages }, bazaarItems] = await Promise.all([
		updateAuctionPrices(binAuctions, ac),
		updateBazaarPrices(binAuctions, ac),
	]);

	// remove auctioned items that are available in the bazaar
	for (const { product_id } of bazaarItems) {
		binAuctions.delete(product_id);
	}

	logger.debug(
		{ binAuctions: binAuctions.size, totalPages, endedAuctions, bazaarItems: bazaarItems.length },
		'[UPDATE PRICES]: completed',
	);

	const updateItem = endedAuctions ? upsertItem : insertItem;

	return Promise.all(binAuctions.map((_auctions, itemId) => updateItem(itemId, Math.min(..._auctions))));
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

const reduceCostsArray = (costs: ArrayElementType<NonNullable<Components.Schemas.SkyBlockItem['upgrade_costs']>>) =>
	costs.reduce((acc, cur) => {
		acc['essence_type' in cur ? `ESSENCE_${cur.essence_type}` : cur.item_id] = cur.amount;
		return acc;
	}, {} as Record<string, number>);

/**
 * update skyblock items
 * @param ac
 */
async function updateSkyBlockItems(ac: AbortController) {
	const { success, items } = await hypixel.resources.skyblock.items({ signal: ac.signal });

	if (!success) return logger.error({ success }, '[UPDATE SKYBLOCK ITEMS]');

	const parsedItems: ParsedSkyBlockItem[] = items.map((item) => ({
		id: item.id,
		dungeon_conversion: item.dungeon_item_conversion_cost
			? { [`ESSENCE_${item.dungeon_item_conversion_cost.essence_type}`]: item.dungeon_item_conversion_cost.amount }
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

	logger.debug({ items: items.length }, '[UPDATE SKYBLOCK ITEMS]: completed');
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
	const res = await request(`https://hypixel.net/forums/${forum}/index.rss`, {
		signal: ac.signal,
		headers: { 'user-agent': 'undici' },
	});

	if (res.statusCode === 200) return (xmlParser.parse(await res.body.text()) as HypixelForumResponse).rss.channel.item;

	void res.body.dump();
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

	logger.debug({ guid: lastGuid }, '[UPDATE PATCH NOTES]: new forum entry');
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
			logger.error(error, '[ON MESSAGE]');
		}
	}
});

/**
 * automatic jobs
 */
let ac: AbortController | null = null;

async function runJobs() {
	if (ac) {
		logger.error('[WORKER]: aborting last jobs');
		ac.abort();
	}

	logger.debug('[WORKER]: running jobs');

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
