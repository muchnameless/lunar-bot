import { Collection } from 'discord.js';
import { logger } from '#logger';
import type {
	Attributes,
	CreationAttributes,
	FindOptions,
	InstanceDestroyOptions,
	Model,
	ModelStatic,
	WhereOptions,
} from 'sequelize';
import type { LunarClient } from '../../LunarClient';

export type ModelResovable<M extends Model> = M | string;

export class ModelManager<M extends Model> {
	declare client: LunarClient;
	model: ModelStatic<M>;
	primaryKey: keyof M; // Attributes<M> doesn't work with InferAttributes (sequelize 6.16.1)
	cache = new Collection<string, M>();

	/**
	 * @param client
	 * @param model
	 */
	constructor(client: LunarClient, model: ModelStatic<M>) {
		Object.defineProperty(this, 'client', { value: client });

		this.model = model;
		this.primaryKey = model.primaryKeyAttribute as keyof M; // TODO: remove cast once above typings issue is fixed
	}

	/**
	 * loads the database cache (performs a sweep first)
	 * @param condition optional condition to query the db with
	 */
	async loadCache(condition?: FindOptions<Attributes<M>>) {
		this.sweepCache();

		for (const element of (await this.model.findAll(condition)) as M[]) {
			this.cache.set(element[this.primaryKey] as unknown as string, element);
		}

		return this;
	}

	/**
	 * sweeps the database cache
	 */
	sweepCache() {
		this.cache.clear();
		return this;
	}

	/**
	 * register cron jobs
	 */
	schedule() {
		return this;
	}

	/**
	 * typeguards the input as instanceof this.model
	 * @param input
	 */
	isModel(input: unknown): input is M {
		return input instanceof this.model;
	}

	/**
	 * fetches an entry from the database and caches it
	 * @param where
	 */
	async fetch({ cache = true, ...where }: WhereOptions<Attributes<M>> & { cache?: boolean }) {
		try {
			const entry = await this.model.findOne({ where: where as WhereOptions<Attributes<M>> });

			if (cache && entry) this.cache.set(entry[this.primaryKey] as unknown as string, entry);

			return entry;
		} catch (error) {
			logger.error(error, `[${this.constructor.name} FETCH]`);
			return null;
		}
	}

	/**
	 * create a new database entry and adds it to the cache
	 * @param options
	 */
	async add(options: CreationAttributes<M>) {
		const newEntry = await this.model.create(options);

		this.cache.set(newEntry[this.primaryKey] as unknown as string, newEntry);

		return newEntry;
	}

	/**
	 * destroys the db entry and removes it from the collection
	 * @param idOrInstance The id or instance of something in this Manager
	 */
	async destroy(idOrInstance: ModelResovable<M>, options?: InstanceDestroyOptions) {
		const element = this.resolve(idOrInstance);
		if (!element) throw new Error(`[${this.constructor.name} REMOVE]: unknown element: ${idOrInstance}`);

		this.cache.delete(element[this.primaryKey] as unknown as string);
		await element.destroy(options);
		return element;
	}

	/**
	 * Resolves a data entry to a data Object.
	 * @param idOrInstance The id or instance of something in this Manager
	 */
	resolve(idOrInstance: ModelResovable<M>) {
		if (this.isModel(idOrInstance)) return idOrInstance;
		if (typeof idOrInstance === 'string') return this.cache.get(idOrInstance) ?? null;
		return null;
	}

	/**
	 * Resolves a data entry to a instance ID.
	 * @param idOrInstance The id or instance of something in this Manager
	 */
	resolveId(idOrInstance: ModelResovable<M>) {
		if (this.isModel(idOrInstance)) return idOrInstance[this.primaryKey] as unknown as string;
		if (typeof idOrInstance === 'string') return idOrInstance;
		return null;
	}

	valueOf() {
		return this.cache;
	}
}
