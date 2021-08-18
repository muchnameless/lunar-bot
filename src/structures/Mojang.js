import fetch from 'node-fetch';
import { validateMinecraftIgn, validateMinecraftUuid } from '../functions/stringValidators.js';
import { MojangAPIError } from './errors/MojangAPIError.js';
// import { logger } from '../functions/logger.js';

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


export class Mojang {
	/**
	 * @param {{ cache: any, requestTimeout?: number, retries?: number }} options
	 */
	constructor({ cache, requestTimeout = 10_000, retries = 1 } = {}) {
		this.cache = cache;
		this.requestTimeout = requestTimeout;
		this.retries = retries;
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

		const parsedRes = await res.json().catch(() => {
			throw new Error('An error occurred while converting to JSON');
		});

		const responses = parsedRes.map(({ id, name }) => ({ uuid: id, ign: name }));

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
		if (validateMinecraftIgn(ign)) return this.#request({
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
		if (validateMinecraftUuid(uuid)) return this.#request({
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
		if (validateMinecraftIgn(ignOrUuid)) return this.#request({
			path: 'https://api.mojang.com/users/profiles/minecraft/',
			query: ignOrUuid.toLowerCase(),
			queryType: 'ign',
			...options,
		});

		if (validateMinecraftUuid(ignOrUuid)) return this.#request({
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
	async #request({ path, query, queryType = null, cache = true, force = false } = {}, retries = 0) {
		if (!force) {
			const cachedResponse = await this.cache?.get(`${queryType}:${query}`);

			if (cachedResponse) {
				if (cachedResponse.error) throw new MojangAPIError({ status: cachedResponse.status?.length ? `${cachedResponse.status} (cached)` : '(cached)', ...cachedResponse }, queryType, query);
				return cachedResponse;
			}
		}

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.requestTimeout);

		let res;

		try {
			res = await fetch(`${path}${query}`, {
				signal: controller.signal,
			});
		} catch (error) {
			// Retry the specified number of times for possible timed out requests
			if (error instanceof Error && error.name === 'AbortError' && retries !== this.retries) {
				return this.#request(arguments[0], retries + 1);
			}

			throw error;
		} finally {
			clearTimeout(timeout);
		}

		switch (res.status) {
			case 200: {
				const { id, name } = await res.json().catch(() => {
					throw new Error('An error occurred while converting to JSON');
				});

				const response = {
					uuid: id,
					ign: name,
				};

				if (cache) {
					this.cache?.set('ign', response.ign.toLowerCase(), response);
					this.cache?.set('uuid', response.uuid, response);
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
			// 			const pastRes = await fetch(`${path}${query}?at=${timestamp}`);

			// 			if (pastRes.status === 200) {
			// 				const { id, name } = await res.json().catch(() => {
			// 					throw new Error('An error occurred while converting to JSON');
			// 				});

			// 				const response = {
			// 					uuid: id,
			// 					ign: name,
			// 				};

			// 				if (cache) {
			// 					// only cache ign -> uuid for outdated igns
			// 					this.cache?.set('ign', response.ign.toLowerCase(), response);
			// 				}

			// 				return response;
			// 			}
			// 		}
			// 	}
			// }
			// falls through

			default:
				if (cache) this.cache?.set(queryType, query, { error: true, res });
				throw new MojangAPIError(res, queryType, query);
		}
	}
}
