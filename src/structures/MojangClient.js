import { fetch } from 'undici';
import { MojangAPIError } from './errors/MojangAPIError.js';
import {
	validateMinecraftIgn,
	validateMinecraftUuid,
} from '../functions/index.js';

/**
 * @typedef MojangResult
 * @property {string} uuid
 * @property {string} ign
 */

/**
 * @typedef MojangFetchOptions
 * @property {boolean} [cache=true]
 * @property {boolean} [force=false]
 */


export class MojangClient {
	/**
	 * @param {{ cache: { get: Function, set: Function }, timeout?: number, retries?: number }} options
	 */
	constructor({ cache, timeout, retries } = {}) {
		this.cache = cache;
		this.timeout = timeout ?? 10_000;
		this.retries = retries ?? 1;
	}

	/**
	 * bulk convertion (1 <= amount  <= 10) for ign -> uuid
	 * @param {string[]} usernames
	 * @returns {Promise<MojangResult[]>}
	 */
	async igns(usernames, { cache = true } = {}) {
		if (!usernames.length || usernames.length > 10) throw new MojangAPIError();

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

		/** @type {MojangResult[]} */
		const responses = (await res.json()).map(({ id, name }) => ({ uuid: id, ign: name }));

		if (cache) {
			for (const response of responses) {
				this.cache?.set('ign', response.ign.toLowerCase(), response);
				this.cache?.set('uuid', response.uuid, response);
			}
		}

		return responses;
	}

	/**
	 * query by ign
	 * @param {string} ign
	 * @param {MojangFetchOptions} [options]
	 */
	async ign(ign, options = {}) {
		if (validateMinecraftIgn(ign)) return this.request({
			path: 'https://api.mojang.com/users/profiles/minecraft/',
			query: ign.toLowerCase(),
			queryType: 'ign',
			...options,
		});

		throw new MojangAPIError({ status: '(validation)' }, 'ign', ign);
	}

	/**
	 * query by uuid
	 * @param {string} uuid
	 * @param {MojangFetchOptions} [options]
	 */
	async uuid(uuid, options = {}) {
		if (validateMinecraftUuid(uuid)) return this.request({
			path: 'https://sessionserver.mojang.com/session/minecraft/profile/',
			query: uuid.toLowerCase().replace(/-/g, ''),
			queryType: 'uuid',
			...options,
		});

		throw new MojangAPIError({ status: '(validation)' }, 'uuid', uuid);
	}

	/**
	 * query by ign or uuid
	 * @param {string} ignOrUuid
	 * @param {MojangFetchOptions} [options]
	 */
	async ignOrUuid(ignOrUuid, options = {}) {
		if (validateMinecraftIgn(ignOrUuid)) return this.request({
			path: 'https://api.mojang.com/users/profiles/minecraft/',
			query: ignOrUuid.toLowerCase(),
			queryType: 'ign',
			...options,
		});

		if (validateMinecraftUuid(ignOrUuid)) return this.request({
			path: 'https://sessionserver.mojang.com/session/minecraft/profile/',
			query: ignOrUuid.toLowerCase().replace(/-/g, ''),
			queryType: 'uuid',
			...options,
		});

		throw new MojangAPIError({ status: '(validation)' }, 'ignOrUuid', ignOrUuid);
	}

	/**
	 * @private
	 * @param {{ path: string, query: string, queryType?: ?string } & MojangFetchOptions} param0
	 * @param {number} [retries] current retry
	 * @returns {Promise<MojangResult>}
	 */
	async request({ path, query, queryType = null, cache = true, force = false } = {}) {
		const CACHE_KEY = `${queryType}:${query}`;

		if (!force) {
			const cachedResponse = await this.cache?.get(CACHE_KEY);

			if (cachedResponse) {
				if (cachedResponse.error) {
					throw new MojangAPIError(
						{ status: Reflect.has(cachedResponse, 'status') ? `${cachedResponse.status} (cached)` : '(cached)', ...cachedResponse },
						queryType,
						query,
					);
				}

				return cachedResponse;
			}
		}

		const res = await this.#request(`${path}${query}`);

		switch (res.status) {
			case 200: {
				/** @type {{ id: string, name: string }} */
				const { id: uuid, name: ign } = await res.json();
				const response = { uuid, ign };

				if (cache) {
					this.cache?.set(`ign:${ign.toLowerCase()}`, response);
					this.cache?.set(`uuid:${uuid}`, response);
				}

				return response;
			}

			/**
			 * mojang api currently ignores ?at= [https://bugs.mojang.com/browse/WEB-3367]
			 */
			// case 204: { // invalid ign
			// 	if (queryType === 'ign') { // retry a past date if name was queried
			// 		let timestamp = Date.now();

			// 		// igns can be changed every 30 days since 2015-02-04T00:00:00.000Z
			// 		while (((timestamp -= 2_592_000_000) >= 1_423_008_000_000)) {
			// 			const pastRes = await this.#request(`${path}${query}?at=${timestamp}`);

			// 			if (pastRes.status === 200) {
			// 				/** @type {{ id: string, name: string }} */
			// 				const { id: uuid, name: ign } = await res.json();
			// 				const response = { uuid, ign };

			// 				if (cache) {
			// 					// only cache ign -> uuid for outdated igns
			// 					this.cache?.set(`ign:${ign.toLowerCase()}`, response);
			// 				}

			// 				return response;
			// 			}
			// 		}
			// 	}
			// }
			// falls through

			default:
				// only check cache if force === true, because otherwise cache is already checked before the request
				if (cache && (!force || !await this.cache?.get(CACHE_KEY))) {
					this.cache?.set(CACHE_KEY, { error: true, status: res.status, statusText: res.statusText });
				}

				throw new MojangAPIError(res, queryType, query);
		}
	}

	/**
	 * @param {string} url
	 * @param {number} [retries=0]
	 * @returns {Promise<import('undici').Response>}
	 */
	async #request(url, retries = 0) {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.timeout);

		try {
			return await fetch(
				url,
				{
					signal: controller.signal,
				},
			);
		} catch (error) {
			// Retry the specified number of times for possible timed out requests
			if (error instanceof Error && error.name === 'AbortError' && retries !== this.retries) {
				return this.#request(url, retries + 1);
			}

			throw error;
		} finally {
			clearTimeout(timeout);
		}
	}
}
