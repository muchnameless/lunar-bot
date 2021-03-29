'use strict';

const ModelManager = require('./ModelManager');
const logger = require('../../../functions/logger');


class ConfigManager extends ModelManager {
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
	 * @param {string} value new value
	 * @returns {Promise<import('../models/Config')>}
	 */
	async set(key, value) {
		const UPPERCASED_KEY = key.toUpperCase();
		const dbEntry = this.cache.get(UPPERCASED_KEY);

		if (!dbEntry) return super.add({ key: UPPERCASED_KEY, value });

		dbEntry.value = value;
		return dbEntry.save();
	}

	/**
	 * get the value of a config entry or `null` if non-existent
	 * @param {string} key config key
	 * @returns {?string} config value
	 */
	get(key) {
		return this.cache.get(key?.toUpperCase())?.value ?? logger.warn(`[CONFIG VALUE]: '${key}' is not a valid config key`);
	}

	/**
	 * get the value of a config entry as a boolean
	 * @param {string} key config key
	 * @returns {?boolean} config value
	 */
	getBoolean(key) {
		const VALUE = this.get(key?.toUpperCase());

		if (!VALUE) return null;

		switch (VALUE.toLowerCase()) {
			case 'true':
			case '1':
				return true;

			case 'false':
			case '0':
				return false;

			default:
				return null;
		}
	}

	/**
	 * get the value of a config entry as a number
	 * @param {string} key config key
	 * @returns {number} config number
	 */
	getNumber(key) {
		return Number(this.get(key?.toUpperCase()));
	}

	/**
	 * returns the value of a config entry as an array, split by ','
	 * @param {string} key config key
	 * @returns {arry} config value
	 */
	getArray(key) {
		return this.get(key?.toUpperCase())?.split(',') ?? [];
	}
}

module.exports = ConfigManager;
