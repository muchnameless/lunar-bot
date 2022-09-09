import { Collection } from 'discord.js';
import {
	type Attributes,
	type CreationAttributes,
	type FindOptions,
	type InstanceDestroyOptions,
	type Model,
	type ModelStatic,
	type WhereOptions,
} from 'sequelize';
import { logger } from '#logger';
import { type LunarClient } from '#structures/LunarClient.js';

export type ModelResovable<M extends Model> = M | string;

export class ModelManager<M extends Model> {
	public declare readonly client: LunarClient;

	public readonly model: ModelStatic<M>;

	public readonly primaryKey: keyof M; // Attributes<M> doesn't work with InferAttributes (sequelize 6.16.1)

	public readonly cache = new Collection<string, M>();

	/**
	 * @param client
	 * @param model
	 */
	public constructor(client: LunarClient, model: ModelStatic<M>) {
		Object.defineProperty(this, 'client', { value: client });

		this.model = model;
		this.primaryKey = model.primaryKeyAttribute as keyof M; // TODO: remove cast once above typings issue is fixed
	}

	/**
	 * loads the database cache (performs a sweep first)
	 *
	 * @param condition - optional condition to query the db with
	 */
	public async loadCache(condition?: FindOptions<Attributes<M>>) {
		this.sweepCache();

		for (const element of (await this.model.findAll(condition)) as M[]) {
			this.cache.set(element[this.primaryKey] as unknown as string, element);
		}

		return this;
	}

	/**
	 * sweeps the database cache
	 */
	public sweepCache() {
		this.cache.clear();
		return this;
	}

	/**
	 * register cron jobs
	 */
	public schedule() {
		return this;
	}

	/**
	 * typeguards the input as instanceof this.model
	 *
	 * @param input
	 */
	public isModel(input: unknown): input is M {
		return input instanceof this.model;
	}

	/**
	 * fetches an entry from the database and caches it
	 *
	 * @param where
	 */
	public async fetch({ cache = true, ...where }: WhereOptions<Attributes<M>> & { cache?: boolean }) {
		try {
			const entry = await this.model.findOne({ where: where as WhereOptions<Attributes<M>> });

			if (cache && entry) this.cache.set(entry[this.primaryKey] as unknown as string, entry);

			return entry;
		} catch (error) {
			logger.error({ err: error, options: { cache, where } }, `[${this.constructor.name} FETCH]`);
			return null;
		}
	}

	/**
	 * create a new database entry and adds it to the cache
	 *
	 * @param options
	 */
	public async add(options: CreationAttributes<M>) {
		const newEntry = await this.model.create(options);

		this.cache.set(newEntry[this.primaryKey] as unknown as string, newEntry);

		return newEntry;
	}

	/**
	 * destroys the db entry and removes it from the collection
	 *
	 * @param idOrInstance - The id or instance of something in this Manager
	 * @param options
	 */
	public async destroy(idOrInstance: ModelResovable<M>, options?: InstanceDestroyOptions) {
		const element = this.resolve(idOrInstance);
		if (!element) throw new Error(`[${this.constructor.name} REMOVE]: unknown element: ${idOrInstance}`);

		this.cache.delete(element[this.primaryKey] as unknown as string);
		await element.destroy(options);
		return element;
	}

	/**
	 * Resolves a data entry to a data Object.
	 *
	 * @param idOrInstance - The id or instance of something in this Manager
	 */
	public resolve(idOrInstance: ModelResovable<M>) {
		if (this.isModel(idOrInstance)) return idOrInstance;
		if (typeof idOrInstance === 'string') return this.cache.get(idOrInstance) ?? null;
		return null;
	}

	/**
	 * Resolves a data entry to a instance ID.
	 *
	 * @param idOrInstance - The id or instance of something in this Manager
	 */
	public resolveId(idOrInstance: ModelResovable<M>) {
		if (this.isModel(idOrInstance)) return idOrInstance[this.primaryKey] as unknown as string;
		if (typeof idOrInstance === 'string') return idOrInstance;
		return null;
	}

	public valueOf() {
		return this.cache;
	}
}
