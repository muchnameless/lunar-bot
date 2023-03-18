import { URL } from 'node:url';
import type { LevelWithSilent } from 'pino';
import { assertNever } from '#functions';
import { logger } from '#logger';
import { populateSkyBlockItems, prices } from '#networth/prices.js';
import type { LunarClient } from '#structures/LunarClient.js';
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
	| { d: null; op: JobType.SkyBlockItemUpdate };

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
						return void client.config.set('HYPIXEL_FORUM_LAST_GUID', message.d);

					case JobType.LogMessage:
						return logger[message.d.lvl](...message.d.args);

					case JobType.SkyBlockItemUpdate:
						void populateSkyBlockItems();
						break;

					case JobType.SkyBlockPriceUpdate:
						return prices.set(message.d.itemId, message.d.price);

					default:
						return assertNever(message);
				}
			},
		}),
	);
}
