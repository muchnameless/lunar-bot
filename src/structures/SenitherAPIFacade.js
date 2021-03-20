'use strict';

const { EventEmitter } = require('events');
const fetch = require('node-fetch');
const { sleep } = require('../functions/util');
const AsyncQueue = require('./AsyncQueue');
// const logger = require('../functions/logger');

/**
 * @typedef {object} FetchOptions
 * @property {boolean} cache
 * @property {boolean} force
 */

/**
 * @typedef {string} Strategy
 * * `last_save_at`
 * * `last_saved`
 * * `last_save`
 * * `latest`
 * * `saved`
 * * `save`
 * * `weights`
 * * `weight`
 * * `we`
 * * `skills`
 * * `skill`
 * * `slayers`
 * * `slayer`
 * * `catacombs`
 * * `catacomb`
 * * `dungeons`
 * * `dungeon`
 * * `cata`
 */

/**
 * v1 base url
 */
const BASE_URL = 'https://hypixel-api.senither.com/v1';

class Method {
	constructor(client) {
		this.client = client;
	}
}

class Profiles extends Method {
	/**
	 * @param {string} uuid
	 * @param {Strategy} strategy
	 * @param {FetchOptions} options
	 */
	uuid(uuid, strategy = '', options = {}) {
		return this.client._makeRequest(`profiles/${uuid}${strategy.length ? `/${strategy}` : ''}`, options);
	}
}

class SenitherAPIFacade extends EventEmitter {
	/**
	 * @param {object} options
	 */
	constructor(key, options = {}) {
		super();
		this._validateInput(key, options);
		this.key = key;
		this.cache = options.cache;

		this.profiles = new Profiles(this);
		this.queue = new AsyncQueue();
		this.rateLimit = {
			remaining: 5,
			reset: 60,
			limit: 120,
		};
	}

	/**
	 * @private
	 * @description validates the client options
	 */
	_validateInput(key, options) {
		if (typeof key !== 'string') throw new TypeError('[SENITHER]: key must be a string');
		if (typeof options !== 'object' || options === null) throw new TypeError('[SENITHER]: options must be an object');
	}

	/**
	 * 'hello worlds' response
	 * @param {FetchOptions} options
	 */
	hello(options) {
		return this._makeRequest('hello', options);
	}

	_getRateLimitHeaders(headers) {
		for (const key of Object.keys(this.rateLimit)) {
			const value = headers.get(`ratelimit-${key}`);
			if (value != null) this.rateLimit[key] = parseInt(value, 10);
		}
	}

	/**
	 * @private
	 * @param {string} path
	 * @param {FetchOptions} options
	 */
	async _makeRequest(path, { cache = true, force = false } = {}) {
		const key = path.replaceAll('/', ':');

		// cached response
		if (this.cache && !force) {
			const cachedResponse = await this.cache.get(key);
			if (cachedResponse) return cachedResponse;
		}

		try {
			await this.queue.wait();

			// rate limit handling
			if (!this.rateLimit.remaining) {
				const timeout = this.rateLimit.reset * 1_000;
				this.emit('limited', this.rateLimit.limit, new Date(Date.now() + timeout));
				await sleep(timeout);
				this.emit('reset');
			}

			// API call
			const result = await fetch(`${BASE_URL}/${path}`, { headers: { 'Authorization': this.key } });

			// parse rate limit headers
			this._getRateLimitHeaders(result.headers);

			// analyze API result
			const parsedResult = await result.json();

			if (parsedResult.status !== 200) throw new Error(`[Error ${parsedResult.status}]: ${parsedResult.reason}`);

			if (this.cache && cache) {
				await this.cache.set(key, parsedResult.data);
			}

			return parsedResult.data;
		} finally {
			this.queue.shift();
		}
	}
}

module.exports = SenitherAPIFacade;
