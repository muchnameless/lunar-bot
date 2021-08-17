import { Collection } from 'discord.js';
import { CronJob } from 'cron';
// import { logger } from '../functions/logger.js';


export class CronJobManager {
	/**
	 * @param {import('./LunarClient').LunarClient} client
	 */
	constructor(client) {
		this.client = client;
		this.cache = new Collection();
	}

	get size() {
		return this.cache.size;
	}

	/**
	 * starts and caches a cronJob
	 * @param {string} name
	 * @param {import('cron').CronJob} cronJob
	 */
	schedule(name, cronJob) {
		cronJob.start();

		this.cache.set(name, cronJob);
	}

	/**
	 * Resolves a data entry to a data Object.
	 * @param {string|Object} keyOrInstance The id or instance of something in this Manager
	 * @returns {?Object} An instance from this Manager
	 * @returns {?CronJob}
	 */
	resolve(keyOrInstance) {
		if (keyOrInstance instanceof CronJob) return keyOrInstance;
		if (typeof keyOrInstance === 'string') return this.cache.get(keyOrInstance) ?? null;
		return null;
	}

	/**
	 * stops and removes a cronJob
	 * @param {string | CronJob} idOrInstance
	 */
	remove(idOrInstance) {
		const cronJob = this.resolve(idOrInstance);

		if (!cronJob) throw new Error(`[CRONJOB REMOVE]: invalid input: '${idOrInstance}'`);

		cronJob.stop();

		const name = this.cache.findKey(x => x === cronJob);

		return this.cache.delete(name);
	}
}
