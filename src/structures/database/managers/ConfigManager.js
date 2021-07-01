'use strict';

const ModelManager = require('./ModelManager');
const logger = require('../../../functions/logger');


module.exports = class ConfigManager extends ModelManager {
	constructor(options) {
		super(options);

		/**
		 * @type {import('discord.js').Collection<string, import('../models/Config')}
		 */
		this.cache;
		/**
		 * @type {import('../models/Config')}
		 */
		this.model;
	}

	/**
	 * upserts a config entry
	 * @param {string} key config key
	 * @param {*} value new value
	 * @returns {Promise<import('../models/Config')>}
	 */
	async set(key, value) {
		const UPPERCASED_KEY = key.toUpperCase();
		const dbEntry = this.cache.get(UPPERCASED_KEY);

		if (!dbEntry) return this.add({ key: UPPERCASED_KEY, value });

		dbEntry.value = value;
		return dbEntry.save();
	}

	/**
	 * get the value of a config entry or `null` if non-existent
	 * @param {string} key config key
	 */
	get(key) {
		return this.cache.get(key?.toUpperCase())?.parsedValue ?? logger.warn(`[CONFIG GET]: '${key}' is not a valid config key`);
	}
};
