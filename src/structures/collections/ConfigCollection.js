'use strict';

const logger = require('../../functions/logger');
const BaseClientCollection = require('./BaseClientCollection');


class ConfigCollection extends BaseClientCollection {
	constructor(client, entries = null) {
		super(client, entries);
	}

	/**
	 * sets a config entry (tries to modify an existing one and creates a new one if non-existend)
	 * @param {string} key config key
	 * @param {string} value new value
	 * @returns {Promise<Config>}
	 */
	async set(key, value) {
		if (value instanceof this.client.db.Config) super.set(key, value);

		key = key.toUpperCase();

		let dbEntry = super.get(key);

		if (!dbEntry) {
			dbEntry = await this.client.db.Config.create({ key, value });
			super.set(key, dbEntry);
			return dbEntry;
		}

		dbEntry.value = value;
		return await dbEntry.save();
	}

	/**
	 * deletes an element from the config
	 * @param {string} key config key
	 */
	async delete(key) {
		key = key.toUpperCase();

		const dbEntry = super.get(key);

		if (!dbEntry) return false;

		await dbEntry.destroy();

		return super.delete(key);
	}

	/**
	 * get the value of a config entry or `null` if non-existent
	 * @param {string} key config key
	 * @returns {string?} config value
	 */
	get(key) {
		return super.get(key?.toUpperCase())?.value
			?? (/^[a-z]+_(?:55|60)_ROLE_ID$/.test(key)
				? null
				: logger.warn(`[CONFIG VALUE] ${key} is not a valid config key`));
	}

	/**
	 * get the value of a config entry as a boolean
	 * @param {string} key config key
	 * @returns {boolean?} config value
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

module.exports = ConfigCollection;
