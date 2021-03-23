'use strict';

const fetch = require('node-fetch');
const { validateMinecraftIGN, validateMinecraftUUID } = require('../functions/stringValidators');
const MojangAPIError = require('./errors/MojangAPIError');
// const logger = require('../functions/logger');


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
		if (!validateMinecraftIGN(username)) return Promise.reject(new MojangAPIError({}, 'id', username));
		return this._makeRequest('https://api.mojang.com/users/profiles/minecraft/', username.toLowerCase(), 'id', options);
	}

	/**
	 * @description converts a uuid to a username
	 * @param {string} uuid
	 * @returns {Promise<string>} username
	 */
	getName(uuid, options = {}) {
		if (typeof uuid !== 'string') throw new TypeError('[Mojang Client]: uuid must be a string');
		if (!validateMinecraftUUID(uuid)) return Promise.reject(new MojangAPIError({}, 'name', uuid));
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
		if (!force) {
			const cachedResponse = await this.cache?.get(query);
			if (cachedResponse) {
				if (typeof cachedResponse === 'string') return cachedResponse;
				throw new MojangAPIError({ status: '(cached)', ...cachedResponse }, resultField, query);
			}
		}

		const res = await fetch(`${path}${query}`);

		if (res.status !== 200) {
			if (cache) this.cache?.set(query, res);
			throw new MojangAPIError(res, resultField, query);
		}

		const parsedRes = await res.json().catch(() => {
			throw new Error('An error occurred while converting to JSON');
		});
		const response = resultField ? parsedRes[resultField] : parsedRes;

		if (cache) this.cache?.set(query, response);

		return response;
	}
}

module.exports = Mojang;
