import { Collection } from 'discord.js';
import { logger } from '../../../functions';
import type { CreateOptions, FindOptions, Model, ModelCtor, WhereOptions } from 'sequelize';
import type { LunarClient } from '../../LunarClient';


export class ModelManager<M extends Model> {
	client: LunarClient;
	model: ModelCtor<M>;
	cache: Collection<string, M>;
	primaryKey: string;

	/**
	 * @param client
	 * @param model
	 */
	constructor(client: LunarClient, model: ModelCtor<M>) {
		this.client = client;
		this.model = model;
		this.cache = new Collection();
		[ this.primaryKey ] = model.primaryKeyAttributes;
	}

	/**
	 * loads the database cache (performs a sweep first)
	 * @param condition optional condition to query the db with
	 */
	async loadCache(condition?: FindOptions) {
		this.sweepCache();

		for (const element of await this.model.findAll(condition) as M[]) {
			this.cache.set(element[this.primaryKey as keyof M] as unknown as string, element);
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
	async fetch({ cache = true, ...where }: WhereOptions & { cache?: boolean }) {
		const entry = await this.model.findOne({ where: where as WhereOptions });

		if (cache && entry) this.cache.set(entry[this.primaryKey as keyof M] as unknown as string, entry);

		return entry;
	}

	/**
	 * create a new database entry and adds it to the cache
	 * @param options
	 */
	async add(options: CreateOptions<M>) {
		const newEntry = await this.model.create(options);

		this.cache.set(newEntry[this.primaryKey as keyof M] as unknown as string, newEntry);

		return newEntry;
	}

	/**
	 * destroys the db entry and removes it from the collection
	 * @param idOrInstance The id or instance of something in this Manager
	 */
	async remove(idOrInstance: string | M) {
		const element = this.resolve(idOrInstance);

		if (!this.isModel(element)) return logger.error(`[MODEL MANAGER REMOVE]: unknown element: ${idOrInstance}`);

		this.cache.delete(element[this.primaryKey as keyof M] as unknown as string);
		return element.destroy();
	}

	/**
	 * Resolves a data entry to a data Object.
	 * @param idOrInstance The id or instance of something in this Manager
	 */
	resolve(idOrInstance: string | M) {
		if (this.isModel(idOrInstance)) return idOrInstance;
		if (typeof idOrInstance === 'string') return this.cache.get(idOrInstance) ?? null;
		return null;
	}

	/**
	 * Resolves a data entry to a instance ID.
	 * @param idOrInstance The id or instance of something in this Manager
	 */
	resolveId(idOrInstance: string | M) {
		if (this.isModel(idOrInstance)) return idOrInstance[this.primaryKey as keyof M] as unknown as string;
		if (typeof idOrInstance === 'string') return idOrInstance;
		return null;
	}

	valueOf() {
		return this.cache;
	}
}
