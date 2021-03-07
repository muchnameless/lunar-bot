'use strict';

const { Collection } = require('discord.js');
const logger = require('../../../functions/logger');


class ModelManager {
	/**
	 * @param {object} param0
	 * @param {import('../../LunarClient')} param0.client
	 * @param {import('sequelize').Model} param0.model
	 */
	constructor({ client, model }) {
		this.client = client;
		this.model = model;
		this.cache = new Collection();
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
	 * create a new database entry and adds it to the cache
	 * @param {object} options
	 */
	async add(options) {
		const newEntry = await this.model.create(options);

		this.cache.set(newEntry[this.primaryKey], newEntry);

		return newEntry;
	}

	/**
	 * destroys the db entry and removes it from the collection
	 * @param {string|Object} idOrInstance The id or instance of something in this Manager
	 */
	async remove(idOrInstance) {
		const element = this.resolve(idOrInstance);

		if (!(element instanceof this.model)) return logger.warn(`[MODEL MANAGER REMOVE]: unknown element: ${idOrInstance}`);

		this.cache.delete(element[this.primaryKey]);
		return element.destroy();
	}

	/**
	 * Resolves a data entry to a data Object.
	 * @param {string|Object} idOrInstance The id or instance of something in this Manager
	 * @returns {?Object} An instance from this Manager
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
	resolveID(idOrInstance) {
		if (idOrInstance instanceof this.model) return idOrInstance[this.primaryKey];
		if (typeof idOrInstance === 'string') return idOrInstance;
		return null;
	}

	valueOf() {
		return this.cache;
	}
}

module.exports = ModelManager;
