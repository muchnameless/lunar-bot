import { CronJob } from 'cron';
import { Collection } from 'discord.js';
import { logger } from '#logger';
import type { LunarClient } from '#structures/LunarClient.js';

export class CronJobManager {
	public declare readonly client: LunarClient;

	public readonly cache = new Collection<string, CronJob>();

	public constructor(client: LunarClient) {
		Object.defineProperty(this, 'client', { value: client });
	}

	/**
	 * starts and caches a cronJob
	 *
	 * @param name
	 * @param cronJob
	 */
	public schedule(name: string, cronJob: CronJob) {
		// prevent multiple cron jobs with the same name
		if (this.cache.has(name)) {
			this.cache.get(name)!.stop();
			logger.warn({ cronJob: name }, '[CRONJOB SCHEDULE]: CronJob already existed');
		}

		cronJob.start();

		this.cache.set(name, cronJob);
	}

	/**
	 * Resolves a data entry to a data Object.
	 *
	 * @param keyOrInstance - The id or instance of something in this Manager
	 * @returns An instance from this Manager
	 */
	public resolve(keyOrInstance: CronJob | string) {
		if (keyOrInstance instanceof CronJob) return keyOrInstance;
		if (typeof keyOrInstance === 'string') return this.cache.get(keyOrInstance) ?? null;
		return null;
	}

	/**
	 * stops and removes a cronJob
	 *
	 * @param idOrInstance
	 */
	public remove(idOrInstance: CronJob | string) {
		const cronJob = this.resolve(idOrInstance);

		if (!cronJob) throw new Error(`[CRONJOB REMOVE]: invalid input: '${idOrInstance}'`);

		cronJob.stop();

		const name = this.cache.findKey((x) => x === cronJob)!;

		return this.cache.delete(name);
	}
}
