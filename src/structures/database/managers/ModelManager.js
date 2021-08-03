'use strict';

const { Collection } = require('discord.js');
const logger = require('../../../functions/logger');


module.exports = class ModelManager {
	/**
	 * @param {object} param0
	 * @param {import('../../LunarClient')} param0.client
	 * @param {import('sequelize').Model} param0.model
	 * @param {Collection} param0.CacheCollection
	 */
	constructor({ client, model, CacheCollection = Collection }) {
		this.client = client;
		this.model = model;
		/** @type {Collection<string, import('sequelize').Model>} */
		this.cache = new CacheCollection();
		[ this.primaryKey ] = this.model.primaryKeyAttributes;
	}

	/**
	 * number of cached instances
	 */
	get size() {
		return this.cache.size;
	}

	/**
	 * loads the database cache (performs a sweep first)
	 * @param {?import('sequelize').FindOptions} condition optional condition to query the db with
	 */
	async loadCache(condition) {
		this.sweepCache();

		for (const element of await this.model.findAll(condition)) {
			this.cache.set(element[this.primaryKey], element);
		}
	}

	/**
	 * sweeps the database cache
	 */
	sweepCache() {
		this.cache.clear();
	}

	/**
	 * fetches an entry from the database and caches it
	 * @param {import('sequelize').WhereOptions & { cache: boolean }} where
	 */
	async fetch({ cache = true, ...where }) {
		/** @type {?import('sequelize').Model} */
		const entry = await this.model.findOne({ where });

		if (cache && entry) this.cache.set(entry[this.primaryKey], entry);

		return entry;
	}

	/**
	 * create a new database entry and adds it to the cache
	 * @param {import('sequelize').CreateOptions} options
	 */
	async add(options) {
		const newEntry = await this.model.create(options);

		this.cache.set(newEntry[this.primaryKey], newEntry);

		return newEntry;
	}

	/**
	 * destroys the db entry and removes it from the collection
	 * @param {string|import('sequelize').Model} idOrInstance The id or instance of something in this Manager
	 */
	async remove(idOrInstance) {
		const element = this.resolve(idOrInstance);

		if (!(element instanceof this.model)) return logger.error(`[MODEL MANAGER REMOVE]: unknown element: ${idOrInstance}`);

		this.cache.delete(element[this.primaryKey]);
		return element.destroy();
	}

	/**
	 * Resolves a data entry to a data Object.
	 * @param {string|import('sequelize').Model} idOrInstance The id or instance of something in this Manager
	 * @returns {?import('sequelize').Model} An instance from this Manager
	 */
	resolve(idOrInstance) {
		if (idOrInstance instanceof this.model) return idOrInstance;
		if (typeof idOrInstance === 'string') return this.cache.get(idOrInstance) ?? null;
		return null;
	}

	/**
	 * Resolves a data entry to a instance ID.
	 * @param {string|Object} idOrInstance The id or instance of something in this Manager
	 * @returns {?string}
	 */
	resolveId(idOrInstance) {
		if (idOrInstance instanceof this.model) return idOrInstance[this.primaryKey];
		if (typeof idOrInstance === 'string') return idOrInstance;
		return null;
	}

	valueOf() {
		return this.cache;
	}
};
