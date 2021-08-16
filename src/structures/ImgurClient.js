import { AsyncQueue } from '@sapphire/async-queue';
import { setTimeout as sleep } from 'timers/promises';
import FormData from 'form-data';
import fetch from 'node-fetch';
import ms from 'ms';
import { IMGUR_KEY } from '../constants/redis.js';
import { cache } from '../api/cache.js';
// import { logger } from '../functions/logger.js';

/**
 * @typedef {object} ImageData
 * @property {string} id
 * @property {?string} title
 * @property {?string} description
 * @property {number} datetime current timestamp in seconds
 * @property {string} type mediatype
 * @property {boolean} animated
 * @property {number} width
 * @property {number} height
 * @property {number} size
 * @property {number} views
 * @property {number} bandwidth
 * @property {?*} vote null
 * @property {boolean} favorite
 * @property {?boolean} nsfw
 * @property {?*} section null
 * @property {?*} account_url null
 * @property {number} account_id
 * @property {boolean} is_ad
 * @property {boolean} in_most_viral
 * @property {boolean} has_sound
 * @property {*[]} tags
 * @property {number} ad_type
 * @property {string} ad_url
 * @property {number} edited
 * @property {boolean} in_gallery
 * @property {string} deletehash
 * @property {string} name
 * @property {string} link
 */

/**
 * @typedef {object} UploadResponse
 * @property {ImageData} data
 * @property {boolean} success
 * @property {number} status
 */


export class ImgurClient {
	#authorization;
	#baseURL;
	#queue = new AsyncQueue();

	/**
	 * @param {{ clientId: string, apiVersion?: string | number, cacheTTL?: number }} param0
	 */
	constructor({ clientId, apiVersion = 3, requestTimeout = 15_000, retries = 1, cacheTTL = 10 * 60 }) {
		this.#authorization = `Client-ID ${clientId}`;
		this.#baseURL = `https://api.imgur.com/${apiVersion}/`;
		this.requestTimeout = requestTimeout;
		this.retries = retries;
		this.cacheTTL = cacheTTL * 1_000;

		this.rateLimit = {
			userlimit: null,
			userremaining: null,
			userreset: null,
			clientlimit: null,
			clientremaining: null,
			clientreset: null,
		};
		this.postRateLimit = {
			limit: null,
			remaining: null,
			reset: null,
		};
	}

	get queue() {
		return this.#queue;
	}

	/**
	 * @param {string} url
	 * @returns {Promise<UploadResponse>}
	 */
	async upload(url) {
		const form = new FormData();

		form.append('image', url);
		form.append('type', 'url');

		return await this.#request({
			endpoint: 'upload',
			method: 'POST',
			body: form,
			cacheKey: `${IMGUR_KEY}:${url}`,
		});
	}

	/**
	 * @param {{ checkRateLimit?: boolean, endpoint: string, method?: string, body: FormData }} param0
	 * @param {number} [retries] current retry
	 */
	async #request({ checkRateLimit = true, endpoint, method = 'POST', body, cacheKey }, retries = 0) {
		const cached = await cache.get(cacheKey);
		if (cached) return cached;

		await this.#queue.wait();

		try {
			// check rate limit
			if (checkRateLimit) {
				if (this.rateLimit.userremaining === 0) {
					const RESET_TIME = (this.rateLimit.userreset * 1_000) - Date.now(); // x-ratelimit-userreset is a timestamp in seconds for next reset

					if (RESET_TIME > 60_000) throw new Error(`imgur user rate limit, resets in ${ms(RESET_TIME, { long: true })}`);
					if (RESET_TIME > 0) await sleep(RESET_TIME);
				}

				if (this.rateLimit.clientremaining === 0) {
					if (this.rateLimit.clientreset === null) throw new Error('imgur client rate limit, unknown clientreset');

					const RESET_TIME = (this.rateLimit.clientreset * 1_000) - Date.now(); // x-ratelimit-clientreset is a timestamp in seconds for next reset (???) - untested

					if (RESET_TIME > 60_000) throw new Error(`imgur client rate limit, resets in ${ms(RESET_TIME, { long: true })}`);
					if (RESET_TIME > 0) await sleep(RESET_TIME);
				}

				if (this.postRateLimit.remaining === 0) {
					const RESET_TIME = this.postRateLimit.reset;

					if (RESET_TIME > 60_000) throw new Error(`imgur post rate limit, resets in ${ms(RESET_TIME, { long: true })}`);
					if (RESET_TIME > 0) await sleep(RESET_TIME);
				}
			}

			// make request
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), this.requestTimeout);

			let res;

			try {
				res = await fetch(`${this.#baseURL}${endpoint}/`, {
					method,
					body,
					headers: {
						Authorization: this.#authorization,
					},
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

			// get ratelimit headers
			for (const type of Object.keys(this.rateLimit)) {
				const data = res.headers.get(`x-ratelimit-${type}`);

				if (data !== null) this.rateLimit[type] = parseInt(data, 10);
			}

			for (const type of Object.keys(this.postRateLimit)) {
				const data = res.headers.get(`x-post-rate-limit-${type}`);

				if (data !== null) {
					this.postRateLimit[type] = type.endsWith('reset')
						? Date.now() + (parseInt(data, 10) * 1_000) // x-post-rate-limit-reset is seconds until reset -> convert to timestamp
						: parseInt(data, 10);
				}
			}

			// check response
			if (res.status !== 200) {
				throw res;
			}

			const parsedRes = await res.json();
			await cache.set(cacheKey, parsedRes, this.cacheTTL); // cache

			return parsedRes;
		} finally {
			this.#queue.shift();
		}
	}
}
