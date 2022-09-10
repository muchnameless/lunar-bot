import { setInterval } from 'node:timers';
import { hours } from '#functions';
import { logger } from '#logger';

export class Warnings<K> {
	public static readonly instances: Warnings<unknown>[] = [];

	static {
		setInterval(() => {
			for (const instance of this.instances) {
				instance._emitted.clear();
			}
		}, hours(12));
	}

	private readonly _emitted = new Set<K>();

	public constructor() {
		Warnings.instances.push(this);
	}

	/**
	 * emit the warning once per key
	 *
	 * @param key
	 * @param args
	 */
	public emit(key: K, ...args: [obj: unknown, msg?: string, ...args: any[]]) {
		if (this._emitted.has(key)) return;

		this._emitted.add(key);
		logger.warn(...args);
	}
}
