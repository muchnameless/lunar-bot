import { URL } from 'node:url';
import { itemUpgrades, prices } from '../structures/networth/prices';
import { logger } from '../logger';
import { Job } from '../structures/jobs/Job';
import { JobManager } from '../structures/jobs/JobManager';
import type { ParsedSkyBlockItem } from './pricesAndPatchNotes';
import type { LunarClient } from '../structures/LunarClient';

export const enum JobType {
	HypixelForumLastGUIDUpdate,
	LogMessage,
	SkyBlockItemUpdate,
	SkyBlockPriceUpdate,
}

export const jobs = new JobManager();

export function startJobs(client: LunarClient) {
	jobs.add(
		new Job(new URL('./pricesAndPatchNotes.js', import.meta.url), {
			message(message: { op: JobType; d: any }) {
				switch (message.op) {
					case JobType.HypixelForumLastGUIDUpdate:
						void client.config.set('HYPIXEL_FORUM_LAST_GUID', message.d);
						break;

					case JobType.LogMessage:
						logger[message.d.lvl as 'info' | 'warn' | 'error'](...(message.d.args as [string]));
						break;

					case JobType.SkyBlockItemUpdate:
						for (const { id, ...data } of message.d as ParsedSkyBlockItem[]) {
							itemUpgrades.set(id, data);
						}
						break;

					case JobType.SkyBlockPriceUpdate:
						prices.set(message.d.itemId, message.d.price);
						break;

					default: {
						const e: never = message.op;
						logger.error(`[JOBS] pricesAndPatchNotes: unknown message op '${e}'`);
					}
				}
			},
		}),
	);
}
