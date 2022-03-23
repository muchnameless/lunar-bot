import { fileURLToPath, URL } from 'node:url';
import { execArgv } from 'node:process';
import Bree from 'bree';
import { logger, minutes, seconds } from '../functions';
import { prices } from '../structures/networth/prices';
import type { LunarClient } from '../structures/LunarClient';

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
		jobs: [
			{
				name: 'pricesAndPatchNotes',
				cron: '*/1 * * * *',
				path: fileURLToPath(new URL('./pricesAndPatchNotes.js', import.meta.url)),
			},
		],
		closeWorkerAfterMs: minutes(1) + seconds(45),
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
					prices.set(message.d.itemId, message.d.price);
					break;
			}
		},
	});

	bree.start();
}
