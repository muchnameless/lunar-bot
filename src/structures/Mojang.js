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
	 * @typedef MojangResult
	 * @property {string} uuid
	 * @property {string} ign
	 */

	/**
	 * bulk convertion (1 <= amount  <= 10) for ign -> uuid
	 * @param {string[]} usernames
	 * @returns {Promise<UUIDsResult[]>}
	 */
	igns(usernames) {
		if (!Array.isArray(usernames)) throw new TypeError('[Mojang Client]: uuids must be an array');
		if (!usernames.length || usernames.length > 10) return Promise.reject(new MojangAPIError());

		return (async () => {
			const res = await fetch(
				'https://api.mojang.com/profiles/minecraft',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(usernames),
				},
			);

			if (res.status !== 200) {
				throw new MojangAPIError(res);
			}

			return await res.json().catch(() => {
				throw new Error('An error occurred while converting to JSON');
			});
		});
	}

	/**
	 * query by ign
	 * @param {string} ign
	 * @returns {Promise<MojangResult>}
	 */
	ign(ign, options = {}) {
		if (typeof ign !== 'string') throw new TypeError('[Mojang Client]: username must be a string');
		if (!validateMinecraftIGN(ign)) return Promise.reject(new MojangAPIError({ status: '(validation)' }, 'ign', ign));
		return this._makeRequest('https://api.mojang.com/users/profiles/minecraft/', ign.toLowerCase(), 'ign', options);
	}

	/**
	 * query by uuid
	 * @param {string} uuid
	 * @returns {Promise<MojangResult>} username
	 */
	uuid(uuid, options = {}) {
		if (typeof uuid !== 'string') throw new TypeError('[Mojang Client]: uuid must be a string');
		if (!validateMinecraftUUID(uuid)) return Promise.reject(new MojangAPIError({ status: '(validation)' }, 'uuid', uuid));
		return this._makeRequest('https://sessionserver.mojang.com/session/minecraft/profile/', uuid.toLowerCase().replace(/-/g, ''), 'uuid', options);
	}

	/**
	 * @private
	 * @param {string} path
	 * @param {string} query
	 * @param {string} queryType
	 * @param {boolean} [param3.cache]
	 * @param {boolean} [param3.force]
	 */
	async _makeRequest(path, query, queryType = null, { cache = true, force = false } = {}) {
		if (!force) {
			const cachedResponse = await this.cache?.get(`${queryType}:${query}`);

			if (cachedResponse) {
				if (cachedResponse.error) throw new MojangAPIError({ status: cachedResponse.status?.length ? `${cachedResponse.status} (cached)` : '(cached)', ...cachedResponse }, queryType, query);
				return cachedResponse;
			}
		}

		const res = await fetch(`${path}${query}`);

		if (res.status !== 200) {
			if (cache) this.cache?.set(`${queryType}:${query}`, { error: true, res });
			throw new MojangAPIError(res, queryType, query);
		}

		const parsedRes = await res.json().catch(() => {
			throw new Error('An error occurred while converting to JSON');
		});

		const response = {
			uuid: parsedRes.id,
			ign: parsedRes.name,
		};

		if (cache) {
			this.cache?.set(`uuid:${response.uuid}`, response);
			this.cache?.set(`ign:${response.ign.toLowerCase()}`, response);
		}

		return response;
	}
}

module.exports = Mojang;
