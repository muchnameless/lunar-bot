import { type Config } from '../models/Config.js';
import { ModelManager } from './ModelManager.js';
import { type ConfigValues } from '#constants';
import { Warnings } from '#structures/Warnings.js';

export class ConfigManager extends ModelManager<Config> {
	public readonly invalidKeyWarnings = new Warnings<string | null | undefined>();

	/**
	 * upserts a config entry
	 *
	 * @param key - config key
	 * @param value - new value
	 */
	public async set(key: string, value: unknown) {
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
	 *
	 * @param key - config key
	 */
	public get<T extends keyof ConfigValues>(key: T): ConfigValues[T];
	public get(key: string): unknown;
	public get(key?: null): null;
	public get(key: string | null | undefined) {
		return (
			// eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
			this.cache.get(key?.toUpperCase()!)?.parsedValue ??
			(this.invalidKeyWarnings.emit(key, { key }, '[CONFIG GET]: invalid key'), null)
		);
	}
}
