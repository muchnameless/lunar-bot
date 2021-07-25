'use strict';

const { AsyncQueue } = require('@sapphire/async-queue');
const FormData = require('form-data');
const fetch = require('node-fetch');
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

		this.timeouts = {
			user: null,
			client: null,
			post: null,
		};

		this.queue = new AsyncQueue();

		this.status();
	}

	static BASE_URL = 'https://api.imgur.com/';

	/**
	 * @param {import('node-fetch').Headers} headers
	 */
	getRateLimitHeaders(headers) {
		logger.error({ headers });

		for (const type of Object.keys(this.rateLimit)) {
			const data = headers.get(`x-ratelimit-${type}`);

			if (data !== null) this.rateLimit[type] = parseInt(data, 10);
		}

		for (const type of Object.keys(this.postRateLimit)) {
			const data = headers.get(`x-post-rate-limit-${type}`);

			if (data !== null) this.postRateLimit[type] = parseInt(data, 10);
		}

		logger.error(this.rateLimit, this.postRateLimit);
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
	 * 
	 */
	async status() {
		const res = await this._request({
			checkRateLimit: false,
			endpoint: 'credits',
		});

		logger.debug({ before: this.rateLimit })

		if ('UserLimit' in res.data) this.rateLimit.userlimit = res.data.UserLimit;
		if ('UserRemaining' in res.data) this.rateLimit.userremaining = res.data.UserRemaining;
		if ('UserReset' in res.data) this.rateLimit.userreset = res.data.UserReset;
		if ('ClientLimit' in res.data) this.rateLimit.clientlimit = res.data.ClientLimit;
		if ('ClientRemaining' in res.data) this.rateLimit.clientremaining = res.data.ClientRemaining;

		logger.debug({ after: this.rateLimit })

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
					if (this.rateLimit.userreset > 60) {
						this.timeouts.user ??= setTimeout(() => {
							this.rateLimit.userremaining = null;
							this.timeouts.user = null;
						}, this.rateLimit.userreset * 1_000);

						throw new Error(`imgur user rate limit, resets in ${this.rateLimit.userreset}s`);
					}

					await sleep(this.rateLimit.userreset * 1_000);
				}

				if (this.rateLimit.clientremaining === 0) {
					if (this.rateLimit.clientreset > 60) {
						this.timeouts.client ??= setTimeout(() => {
							this.rateLimit.clientremaining = null;
							this.timeouts.client = null;
						}, this.rateLimit.clientreset * 1_000);

						throw new Error(`imgur client rate limit, resets in ${this.rateLimit.clientreset}s`);
					}

					await sleep(this.rateLimit.clientreset * 1_000);
				}

				if (this.postRateLimit.remaining === 0) {
					if (this.postRateLimit.reset > 60) {
						this.timeouts.post ??= setTimeout(() => {
							this.postRateLimit.remaining = null;
							this.timeouts.post = null;
						}, this.postRateLimit.reset * 1_000);

						throw new Error(`imgur post rate limit, resets in ${this.postRateLimit.reset}s`);
					}

					await sleep(this.postRateLimit.reset * 1_000);
				}
			}

			logger.debug(`${ImgurClient.BASE_URL}${this.apiVersion}/${endpoint}/`)

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
