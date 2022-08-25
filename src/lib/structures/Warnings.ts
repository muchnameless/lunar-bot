import { logger } from '#logger';

export class Warnings<K> {
	private _emitted = new Set<K>();

	/**
	 * emit the warning once per key
	 * @param key
	 * @param args
	 */
	emit(key: K, ...args: [obj: unknown, msg?: string, ...args: any[]]) {
		if (this._emitted.has(key)) return;

		this._emitted.add(key);
		logger.warn(...args);
	}
}
