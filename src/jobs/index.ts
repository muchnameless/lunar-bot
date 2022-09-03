import { URL } from 'node:url';
import { type LevelWithSilent } from 'pino';
import { type ParsedSkyBlockItem } from './pricesAndPatchNotes.js';
import { assertNever } from '#functions';
import { logger } from '#logger';
import { itemUpgrades, prices, accessories } from '#networth/prices.js';
import { type LunarClient } from '#structures/LunarClient.js';
import { Job } from '#structures/jobs/Job.js';
import { JobManager } from '#structures/jobs/JobManager.js';

export const enum JobType {
	HypixelForumLastGUIDUpdate,
	LogMessage,
	SkyBlockItemUpdate,
	SkyBlockPriceUpdate,
}

type WorkerMessage =
	| {
			d: number;
			op: JobType.HypixelForumLastGUIDUpdate;
	  }
	| { d: { args: [string]; lvl: LevelWithSilent }; op: JobType.LogMessage }
	| { d: { itemId: string; price: number }; op: JobType.SkyBlockPriceUpdate }
	| { d: ParsedSkyBlockItem[]; op: JobType.SkyBlockItemUpdate };

export const jobs = new JobManager();

/**
 * start jobs and add listeners for messages from worker threads
 *
 * @param client
 */
export function startJobs(client: LunarClient) {
	jobs.add(
		new Job(new URL('pricesAndPatchNotes.js', import.meta.url), {
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
						assertNever(message);
				}
			},
		}),
	);
}
