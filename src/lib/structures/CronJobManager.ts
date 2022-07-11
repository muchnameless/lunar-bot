import { Collection } from 'discord.js';
import { CronJob } from 'cron';
import { logger } from '#logger';
import type { LunarClient } from './LunarClient';

export class CronJobManager {
	client: LunarClient;
	cache = new Collection<string, CronJob>();

	constructor(client: LunarClient) {
		this.client = client;
	}

	/**
	 * starts and caches a cronJob
	 * @param name
	 * @param cronJob
	 */
	schedule(name: string, cronJob: CronJob) {
		// prevent multiple cron jobs with the same name
		if (this.cache.has(name)) {
			this.cache.get(name)!.stop();
			logger.warn(`[CRONJOB SCHEDULE]: CronJob '${name}' already existed`);
		}

		cronJob.start();

		this.cache.set(name, cronJob);
	}

	/**
	 * Resolves a data entry to a data Object.
	 * @param keyOrInstance The id or instance of something in this Manager
	 * @returns An instance from this Manager
	 */
	resolve(keyOrInstance: string | CronJob) {
		if (keyOrInstance instanceof CronJob) return keyOrInstance;
		if (typeof keyOrInstance === 'string') return this.cache.get(keyOrInstance) ?? null;
		return null;
	}

	/**
	 * stops and removes a cronJob
	 * @param idOrInstance
	 */
	remove(idOrInstance: string | CronJob) {
		const cronJob = this.resolve(idOrInstance);

		if (!cronJob) throw new Error(`[CRONJOB REMOVE]: invalid input: '${idOrInstance}'`);

		cronJob.stop();

		const name = this.cache.findKey((x) => x === cronJob)!;

		return this.cache.delete(name);
	}
}
