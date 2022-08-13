import { Collection } from 'discord.js';
import type { Snowflake } from 'discord.js';

export abstract class BaseCache<V, K = Snowflake> {
	protected _cache = new Collection<K, V>();
	protected declare static _maxAge: number;

	abstract get(id: K): V | null;
	abstract sweep(): number;
}
