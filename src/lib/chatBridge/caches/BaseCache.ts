import { setInterval } from 'node:timers';
import { Collection } from 'discord.js';
import type { Snowflake } from 'discord.js';

export abstract class BaseCache<V, K = Snowflake> {
	protected _cache = new Collection<K, V>();
	protected declare static _maxAge: number;
	protected _sweepInterval: NodeJS.Timer;

	constructor(intervalTime: number) {
		this._sweepInterval = setInterval(() => this._sweep(), intervalTime);
	}

	abstract get(id: Snowflake): V | null;
	protected abstract _sweep(): number;
}
