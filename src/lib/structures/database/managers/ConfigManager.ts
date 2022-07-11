import { logger } from '#logger';
import { ModelManager } from './ModelManager';
import type { Config } from '../models/Config';
import type { ConfigValues } from '#constants';

export class ConfigManager extends ModelManager<Config> {
	/**
	 * upserts a config entry
	 * @param key config key
	 * @param value new value
	 */
	set(key: string, value: unknown) {
		const UPPERCASED_KEY = key.toUpperCase();
		const dbEntry = this.cache.get(UPPERCASED_KEY);

		if (!dbEntry) {
			return this.add({
				key: UPPERCASED_KEY,
				value: value as string,
			});
		}

		// the value setter makes sure that non strings get JSON.stringified
		return dbEntry.update({ value: value as string });
	}

	/**
	 * get the value of a config entry or `null` if non-existent
	 * @param key config key
	 */
	get<T extends keyof ConfigValues>(key: T): ConfigValues[T];
	get(key: string): unknown;
	get(key?: null): null;
	get(key: any) {
		return (
			this.cache.get(key?.toUpperCase()!)?.parsedValue ??
			(logger.warn(`[CONFIG GET]: '${key}' is not a valid config key`), null)
		);
	}
}
