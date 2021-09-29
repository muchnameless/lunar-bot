import { logger } from '../../../functions';
import { ModelManager } from './ModelManager';
import type { Config } from '../models/Config';


export class ConfigManager extends ModelManager<Config> {
	/**
	 * upserts a config entry
	 * @param key config key
	 * @param value new value
	 */
	async set(key: string, value: unknown) {
		const UPPERCASED_KEY = key.toUpperCase();
		const dbEntry = this.cache.get(UPPERCASED_KEY);

		if (!dbEntry) return this.add({ key: UPPERCASED_KEY, value });

		dbEntry.value = value as string;
		return dbEntry.save();
	}

	/**
	 * get the value of a config entry or `null` if non-existent
	 * @param key config key
	 */
	get(key: string): unknown {
		return this.cache.get(key?.toUpperCase())?.parsedValue ?? logger.warn(`[CONFIG GET]: '${key}' is not a valid config key`);
	}
}
