import { LimitedCollection } from 'discord.js';
import type { Snowflake } from 'discord.js';

export abstract class BaseCache<V, K = Snowflake> {
	protected _cache = new LimitedCollection<K, V>({ maxSize: 200 });
	protected declare static _maxAge: number;

	abstract get(id: K): V | null;
	abstract sweep(): number;
}
