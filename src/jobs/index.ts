import { URL } from 'node:url';
import { itemUpgrades, prices, accessories } from '../structures/networth/prices';
import { logger } from '../logger';
import { Job } from '../structures/jobs/Job';
import { JobManager } from '../structures/jobs/JobManager';
import { assertNever } from '../functions';
import type { LevelWithSilent } from 'pino';
import type { ParsedSkyBlockItem } from './pricesAndPatchNotes';
import type { LunarClient } from '../structures/LunarClient';

export const enum JobType {
	HypixelForumLastGUIDUpdate,
	LogMessage,
	SkyBlockItemUpdate,
	SkyBlockPriceUpdate,
}

type WorkerMessage =
	| {
			op: JobType.HypixelForumLastGUIDUpdate;
			d: number;
	  }
	| { op: JobType.LogMessage; d: { lvl: LevelWithSilent; args: [string] } }
	| { op: JobType.SkyBlockItemUpdate; d: ParsedSkyBlockItem[] }
	| { op: JobType.SkyBlockPriceUpdate; d: { itemId: string; price: number } };

export const jobs = new JobManager();

/**
 * start jobs and add listeners for messages from worker threads
 * @param client
 */
export function startJobs(client: LunarClient) {
	jobs.add(
		new Job(new URL('./pricesAndPatchNotes.js', import.meta.url), {
			message(message: WorkerMessage) {
				switch (message.op) {
					case JobType.HypixelForumLastGUIDUpdate:
						void client.config.set('HYPIXEL_FORUM_LAST_GUID', message.d);
						break;

					case JobType.LogMessage:
						logger[message.d.lvl](...message.d.args);
						break;

					case JobType.SkyBlockItemUpdate:
						if (!message.d.length) return;

						accessories.clear();
						itemUpgrades.clear();

						for (const { id, category, ...data } of message.d) {
							if (category === 'ACCESSORY') accessories.add(id);
							if (data.stars) itemUpgrades.set(id, data);
						}
						break;

					case JobType.SkyBlockPriceUpdate:
						prices.set(message.d.itemId, message.d.price);
						break;

					default:
						return assertNever(message);
				}
			},
		}),
	);
}
