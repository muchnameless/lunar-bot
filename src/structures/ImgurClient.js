'use strict';

const { AsyncQueue } = require('@sapphire/async-queue');
const FormData = require('form-data');
const fetch = require('node-fetch');
const ms = require('ms');
const { sleep } = require('../functions/util');
const logger = require('../functions/logger');


module.exports = class ImgurClient {
	/**
	 * @param {{ authorization: string, apiVersion: string | number }} param0
	 */
	constructor({ authorization, apiVersion = 3 }) {
		this.authorization = authorization;
		this.apiVersion = apiVersion;

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

		this.queue = new AsyncQueue();

		this.status();
	}

	static BASE_URL = 'https://api.imgur.com/';

	/**
	 * @param {import('node-fetch').Headers} headers
	 */
	getRateLimitHeaders(headers) {
		for (const type of Object.keys(this.rateLimit)) {
			const data = headers.get(`x-ratelimit-${type}`);

			if (data !== null) this.rateLimit[type] = parseInt(data, 10);
		}

		for (const type of Object.keys(this.postRateLimit)) {
			const data = headers.get(`x-post-rate-limit-${type}`);

			if (data !== null) {
				this.postRateLimit[type] = type.endsWith('reset')
					? Date.now() + (parseInt(data, 10) * 1_000) // x-post-rate-limit-reset is seconds until reset -> convert to timestamp
					: parseInt(data, 10);
			}
		}

		logger.error({ ...this.rateLimit, ...this.postRateLimit });
	}

	/**
	 * @param {string} url
	 * @returns {Promise<string>}
	 */
	async upload(url) {
		const form = new FormData();

		form.append('image', url);
		form.append('type', 'url');

		return (await this._request({
			endpoint: 'upload',
			method: 'POST',
			body: form,
		})).data.link;
	}

	/**
	 * ratelimit status / remaining credits
	 */
	async status() {
		const res = await this._request({
			checkRateLimit: false,
			endpoint: 'credits',
		});

		if ('UserLimit' in res.data) this.rateLimit.userlimit = res.data.UserLimit;
		if ('UserRemaining' in res.data) this.rateLimit.userremaining = res.data.UserRemaining;
		if ('UserReset' in res.data) this.rateLimit.userreset = res.data.UserReset;
		if ('ClientLimit' in res.data) this.rateLimit.clientlimit = res.data.ClientLimit;
		if ('ClientRemaining' in res.data) this.rateLimit.clientremaining = res.data.ClientRemaining;

		logger.error({ ...this.rateLimit, ...this.postRateLimit });

		return res;
	}

	/**
	 * @param {{ checkRateLimit: boolean, endpoint: string, method: string, body: FormData }} param0
	 */
	async _request({ checkRateLimit = true, endpoint, method, body }) {
		await this.queue.wait();

		try {
			if (checkRateLimit) {
				if (this.rateLimit.userremaining === 0) {
					const RESET_TIME = (this.rateLimit.userreset * 1_000) - Date.now(); // x-ratelimit-userreset is a timestamp in seconds for next reset

					if (RESET_TIME > 60_000) throw new Error(`imgur user rate limit, resets in ${ms(RESET_TIME, { long: true })}`);
					if (RESET_TIME > 0) await sleep(RESET_TIME);
				}

				if (this.rateLimit.clientremaining === 0) {
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

			const res = await fetch(`${ImgurClient.BASE_URL}${this.apiVersion}/${endpoint}/`, {
				method,
				body,
				headers: {
					Authorization: this.authorization,
				},
			});

			this.getRateLimitHeaders(res.headers);

			if (res.status !== 200) {
				throw new Error(res);
			}

			return await res.json();
		} finally {
			this.queue.shift();
		}
	}
};
