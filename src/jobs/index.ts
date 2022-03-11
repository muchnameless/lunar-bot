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

export let bree: Bree;

export function startJobs(client: LunarClient) {
	bree = new Bree({
		root: false,
		logger: logger as unknown as Record<string, unknown>,
		worker: { execArgv: [...execArgv, '--no-warnings'] },
		errorHandler(error, workerMetadata) {
			logger.error({ err: error, workerMetadata }, '[BREE]');
		},
		workerMessageHandler({ message, name }: { message: 'done' | { op: JobType; d: any }; name: string }) {
			if (message === 'done') return logger.info(`[BREE]: '${name}' signaled completion`);

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
		},
	});

	bree.add([
		{
			name: 'skyblockPatchNotes',
			cron: '*/1 * * * *',
			path: fileURLToPath(new URL('./skyblockPatchNotes.js', import.meta.url)),
		},
		{
			name: 'skyblockAuctions',
			cron: '*/1 * * * *',
			path: fileURLToPath(new URL('./skyblockAuctions.js', import.meta.url)),
		},
	]);

	bree.start();
}
