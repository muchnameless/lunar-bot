'use strict';

const fetch = require('node-fetch');
const MojangAPIError = require('./errors/MojangAPIError');
const logger = require('../functions/logger');


class Mojang {
	/**
	 * @param {object} options
	 */
	constructor(options = {}) {
		this._validateOptions(options);
		this.cache = options.cache;
		this.wrongInputCache = new Map();
	}

	/**
	 * @private
	 * @description validates the client options
	 */
	_validateOptions(options) {
		if (typeof options !== 'object' || options === null) throw new TypeError('[Mojang Client]: options must be an object');
	}

	/**
	 * @description converts a username to a uuid
	 * @param {string} username
	 * @returns {Promise<string>} uuid
	 */
	getUUID(username, options = {}) {
		if (typeof username !== 'string' || !/^\w{3,16}$/.test(username)) throw new TypeError('[Mojang Client]: invalid username');
		return this._makeRequest('https://api.mojang.com/users/profiles/minecraft/', username.toLowerCase(), 'id', options);
	}

	/**
	 * @description converts a uuid to a username
	 * @param {string} uuid
	 * @returns {Promise<string>} username
	 */
	getName(uuid, options = {}) {
		if (typeof uuid !== 'string' || !/^[0-9a-f]{8}-?(?:[0-9a-f]{4}-?){3}[0-9a-f]{12}$/i.test(uuid)) throw new TypeError('[Mojang Client]: invalid uuid');
		return this._makeRequest('https://sessionserver.mojang.com/session/minecraft/profile/', uuid.toLowerCase().replace(/-/g, ''), 'name', options);
	}

	/**
	 * @private
	 * @param {string} path
	 * @param {string} query
	 * @param {string} resultField
	 * @param {boolean} [param3.cache]
	 * @param {boolean} [param3.force]
	 */
	async _makeRequest(path, query, resultField = null, { cache = true, force = false } = {}) {
		if (this.cache && !force) {
			const cachedResponse = await this.cache.get(query);
			if (cachedResponse) return cachedResponse;
		}

		if (this.wrongInputCache.has(query)) {
			logger.error(`[MOJANG]: cached error for '${query}' in '${resultField}'`);
			throw new MojangAPIError(this.wrongInputCache.get(query), resultField);
		}

		const res = await fetch(`${path}${query}`);

		if (res.status !== 200) {
			this.wrongInputCache.set(query, res);
			setTimeout(() => this.wrongInputCache.delete(query), 30 * 60_000);
			throw new MojangAPIError(res, resultField);
		}

		const parsedRes = await res.json().catch(() => {
			throw new Error('An error occurred while converting to JSON');
		});
		const response = resultField ? parsedRes[resultField] : parsedRes;

		if (this.cache && cache) {
			await this.cache.set(query, response);
		}

		return response;
	}
}

module.exports = Mojang;
