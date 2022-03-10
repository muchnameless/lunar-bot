import { fileURLToPath, URL } from 'node:url';
import { execArgv } from 'node:process';
import Bree from 'bree';
import { logger } from '../functions';
import { prices } from '../structures/networth/prices';
import type { LunarClient } from '../structures/LunarClient';
import type { ItemPrice } from './skyblockAuctions';

export const enum JobType {
	HypixelForumLastGUIDUpdate,
	SkyblockAuctionPriceUpdate,
}

export const bree = new Bree({ root: false, logger: logger as unknown as Record<string, unknown> });

bree.add({
	name: 'skyblockPatchNotes',
	cron: '*/1 * * * *',
	path: fileURLToPath(new URL('./skyblockPatchNotes.js', import.meta.url)),
	worker: { execArgv: [...execArgv, '--no-warnings'] },
});

bree.add({
	name: 'skyblockAuctions',
	cron: '*/1 * * * *',
	path: fileURLToPath(new URL('./skyblockAuctions.js', import.meta.url)),
	worker: { execArgv: [...execArgv, '--no-warnings'] },
});

export function startJobs(client: LunarClient) {
	bree.on('worker created', (name) => {
		bree.workers.get(name)?.on('message', (message) => {
			if (message === 'done') return;

			switch (message.op) {
				case JobType.HypixelForumLastGUIDUpdate:
					client.config.set('HYPIXEL_FORUM_LAST_GUID', message.d);
					break;

				case JobType.SkyblockAuctionPriceUpdate:
					for (const { itemId, price } of message.d.itemPrices as ItemPrice[]) {
						prices.set(itemId, price);
					}
					logger.debug(
						`[UPDATE PRICES]: updated ${message.d.itemPrices.length} items from ${message.d.totalPages} auction pages`,
					);
					break;
			}
		});
	});

	bree.on('worker deleted', (name) => {
		bree.workers.get(name)?.removeAllListeners();
	});

	bree.start();
}
