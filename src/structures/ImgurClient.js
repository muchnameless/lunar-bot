import { AsyncQueue } from '@sapphire/async-queue';
import { setTimeout as sleep } from 'timers/promises';
import { fetch, FormData } from 'undici';
import ms from 'ms';
import { ImgurAPIError } from './errors/ImgurAPIError.js';

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
	 * @param {string} clientId
	 * @param {{ cache?: { get: Function, set: Function }, apiVersion?: number, requestTimeout?: number, rateLimitOffset?: number, rateLimitedWaitTime?: number, retries?: number}} [param1]
	 */
	constructor(clientId, { cache, apiVersion, requestTimeout, rateLimitOffset, rateLimitedWaitTime, retries } = {}) {
		this.cache = cache;
		this.#authorization = `Client-ID ${clientId}`;
		this.#baseURL = `https://api.imgur.com/${apiVersion ?? 3}/`;
		this.requestTimeout = requestTimeout ?? 10_000;
		this.rateLimitOffset = rateLimitOffset ?? 1_000;
		this.rateLimitedWaitTime = rateLimitedWaitTime ?? 60_000;
		this.retries = retries ?? 1;

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

	/**
	 * request queue
	 */
	get queue() {
		return this.#queue;
	}

	/**
	 * uploads an image by URL
	 * @param {string} url
	 * @returns {Promise<UploadResponse>}
	 */
	async upload(url) {
		const form = new FormData();

		form.append('image', url);
		form.append('type', 'url');

		return this.request(
			'upload',
			{
				method: 'POST',
				body: form,
			}, {
				checkRateLimit: true,
				cacheKey: url,
			},
		);
	}

	/**
	 * @param {string} endpoint
	 * @param {import('undici').RequestInit} options
	 * @param {{ checkRateLimit?: boolean, cacheKey: string }} param2
	 */
	async request(endpoint, options, { checkRateLimit = true, cacheKey }) {
		const cached = await this.cache?.get(cacheKey);
		if (cached) return cached;

		await this.#queue.wait();

		try {
			// check rate limit
			if (checkRateLimit) {
				if (this.rateLimit.userremaining === 0) {
					const RESET_TIME = this.rateLimit.userreset - Date.now();

					if (RESET_TIME > this.rateLimitedWaitTime) throw new Error(`imgur user rate limit, resets in ${ms(RESET_TIME, { long: true })}`);
					if (RESET_TIME > 0) await sleep(RESET_TIME);
				}

				if (this.rateLimit.clientremaining === 0) {
					if (this.rateLimit.clientreset === null) throw new Error('imgur client rate limit, unknown clientreset');

					const RESET_TIME = this.rateLimit.clientreset - Date.now();

					if (RESET_TIME > this.rateLimitedWaitTime) throw new Error(`imgur client rate limit, resets in ${ms(RESET_TIME, { long: true })}`);
					if (RESET_TIME > 0) await sleep(RESET_TIME);
				}

				if ((options.method === 'POST' || !options.method) && this.postRateLimit.remaining === 0) {
					const RESET_TIME = this.postRateLimit.reset - Date.now();

					if (RESET_TIME > this.rateLimitedWaitTime) throw new Error(`imgur post rate limit, resets in ${ms(RESET_TIME, { long: true })}`);
					if (RESET_TIME > 0) await sleep(RESET_TIME);
				}
			}

			const res = await this.#request(endpoint, options);

			// get ratelimit headers
			for (const type of Object.keys(this.rateLimit)) {
				const data = res.headers.get(`x-ratelimit-${type}`);

				if (data !== null) {
					this.rateLimit[type] = type.endsWith('reset')
						? Date.now() + (parseInt(data, 10) * 1_000) + this.rateLimitOffset // x-ratelimit-reset is seconds until reset -> convert to timestamp
						: parseInt(data, 10);
				}
			}

			for (const type of Object.keys(this.postRateLimit)) {
				const data = res.headers.get(`x-post-rate-limit-${type}`);

				if (data !== null) {
					this.postRateLimit[type] = type.endsWith('reset')
						? Date.now() + (parseInt(data, 10) * 1_000) + this.rateLimitOffset // x-post-rate-limit-reset is seconds until reset -> convert to timestamp
						: parseInt(data, 10);
				}
			}

			// check response
			if (res.status !== 200) {
				throw new ImgurAPIError(res);
			}

			const parsedRes = await res.json();
			await this.cache?.set(cacheKey, parsedRes); // cache

			return parsedRes;
		} finally {
			this.#queue.shift();
		}
	}

	/**
	 * make request
	 * @param {string} endpoint
	 * @param {import('undici').RequestInit} options
	 * @param {number} [retries=0] current retry
	 * @returns {Promise<import('undici').Response>}
	 */
	async #request(endpoint, options, retries = 0) {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.requestTimeout);

		try {
			return await fetch(
				`${this.#baseURL}${endpoint}`,
				{
					headers: {
						Authorization: this.#authorization,
					},
					signal: controller.signal,
					...options,
				},
			);
		} catch (error) {
			// Retry the specified number of times for possible timed out requests
			if (error instanceof Error && error.name === 'AbortError' && retries !== this.retries) {
				return this.#request(endpoint, options, retries + 1);
			}

			throw error;
		} finally {
			clearTimeout(timeout);
		}
	}
}
