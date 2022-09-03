import { LimitedCollection, type Snowflake } from 'discord.js';

export abstract class BaseCache<V, K = Snowflake> {
	protected readonly _cache = new LimitedCollection<K, V>({ maxSize: 200 });

	protected declare static readonly _maxAge: number;

	public abstract get(id: K): V | null;
	public abstract sweep(): number;
}
