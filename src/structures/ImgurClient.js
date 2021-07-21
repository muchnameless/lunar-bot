'use strict';

const { AsyncQueue } = require('@sapphire/async-queue');
const FormData = require('form-data');
const fetch = require('node-fetch');
const { sleep } = require('../functions/util');
const logger = require('../functions/logger');


module.exports = class ImgurClient {
	/**
	 * @param {{ authorization: string }} param0
	 */
	constructor({ authorization }) {
		this.authorization = authorization;

		this.rateLimit = {
			clientlimit: null,
			clientremaining: null,
			clientreset: null,
			userlimit: null,
			userremaining: null,
			userreset: null,
		};

		this.postRateLimit = {
			limit: null,
			remaining: null,
			reset: null,
		};

		this.queue = new AsyncQueue();
	}

	/**
	 * @param {import('node-fetch').Headers} headers
	 */
	getRateLimitHeaders(headers) {
		logger.error({ headers })

		for (const type of Object.keys(this.rateLimit)) {
			const data = headers.get(`x-ratelimit-${type}`);

			if (typeof data === 'undefined') continue;

			this.rateLimit[type] = parseInt(data, 10);
		}

		for (const type of Object.keys(this.postRateLimit)) {
			const data = headers.get(`x-post-rate-limit-${type}`);

			if (typeof data === 'undefined') continue;

			this.postRateLimit[type] = parseInt(data, 10);
		}

		logger.error(this.rateLimit, this.postRateLimit)
	}

	/**
	 * @param {string} url
	 * @returns {Promise<string>}
	 */
	async upload(url) {
		await this.queue.wait();

		try {
			if (this.rateLimit.clientremaining === 0) {
				if (this.rateLimit.clientreset > 60) throw new Error(`imgur client rate limit, reset in ${this.rateLimit.clientreset}`);
				await sleep(this.rateLimit.clientreset * 1_000);
			}

			if (this.rateLimit.userremaining === 0) {
				if (this.rateLimit.userreset > 60) throw new Error(`imgur user rate limit, reset in ${this.rateLimit.userreset}`);
				await sleep(this.rateLimit.userreset * 1_000);
			}

			if (this.postRateLimit.remaining === 0) {
				if (this.postRateLimit.reset > 60) throw new Error(`imgur post rate limit, reset in ${this.postRateLimit.reset}`);
				await sleep(this.postRateLimit.reset * 1_000);
			}

			const form = new FormData();

			form.append('image', url);
			form.append('type', 'url');

			const res = await fetch('https://api.imgur.com/3/upload', {
				method: 'POST',
				body: form,
				headers: {
					Authorization: this.authorization,
				},
			});

			this.getRateLimitHeaders(res.headers);

			if (res.status !== 200) {
				logger.error('IMGUR', res);
				throw new Error('error uploading to imgur');
			}

			return (await res.json()).data.link;
		} finally {
			this.queue.shift();
		}
	}
};
