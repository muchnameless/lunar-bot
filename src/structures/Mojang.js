'use strict';

const fetch = require('node-fetch');


class Mojang {

	/**
	 * @param {object} options
	 */
	constructor(options = {}) {
		this._validateOptions(options);
		this.cache = options.cache;
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
		if (typeof username !== 'string') throw new TypeError('[Mojang Client]: username must be a string');
		return this._makeRequest('https://api.mojang.com/users/profiles/minecraft/', username.toLowerCase(), 'id', options);
	}

	/**
	 * @description converts a uuid to a username
	 * @param {string} uuid
	 * @returns {Promise<string>} username
	 */
	getName(uuid, options = {}) {
		if (typeof uuid !== 'string') throw new TypeError('[Mojang Client]: uuid must be a string');
		return this._makeRequest('https://sessionserver.mojang.com/session/minecraft/profile/', uuid.toLowerCase().replace(/-/g, ''), 'name', options);
	}

	/**
	 * @private
	 * @param {string} path
	 * @param {string} query
	 * @param {string} resultField
	 */
	async _makeRequest(path, query, resultField = null, options) {
		if (typeof options !== 'object' || options === null) throw new TypeError('[Mojang Client]: options must be an object');
		const { cache = true, force = false } = options;

		if (this.cache && !force) {
			const cachedResponse = await this.cache.get(query);
			if (cachedResponse) return cachedResponse;
		}

		const res = await fetch(path + query);

		if (res.status !== 200) throw new Error(`Error ${res.status}: ${res.statusText}`);

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
