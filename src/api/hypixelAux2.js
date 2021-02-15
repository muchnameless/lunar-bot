'use strict';

const { Client } = require('@zikeji/hypixel');
const cache = require('./cache');
const logger = require('../functions/logger');


const hypixel = new Client(process.env.HYPIXEL_KEY_AUX_2, {
	cache: {
		// these don't need to be async since cache.get / cache.set will return a promise
		get(key) {
			return cache.get(`hypixel:${key}`);
		},
		set(key, value) {
			// default 5 minute ttl - useful for alost of endpoints
			let ttl = 5 * 60;

			if (key.startsWith('skyblock:profile') || key.startsWith('player') || key.startsWith('guild')) {
				ttl = 60;
			} else if (key.startsWith('skyblock:auction')) {
				ttl = 4 * 60;

			// the following endpoints don't require API keys and won't eat into your rate limit
			} else if (key.startsWith('resources:')) {
				ttl = 24 * 60 * 60; // 24 hours as resources don't update often, if at all
			} else if (key === 'skyblock:bazaar') {
				// this endpoint is cached by cloudflare and updates every 10 seconds
				ttl = 10;
			} else if (key.startsWith('skyblock:auctions:')) {
				return; // don't cache this endpoint

				// this endpoint is cached by cloudflare and updates every 60 seconds
				// ttl = 60;
			}

			// prepend our key with "hypixel" so we don't conflict with anyone else
			return cache.set(`hypixel:${key}`, value, { ttl });
		},
	},
});

hypixel
	.on('limited', (limit, reset) => logger.warn(`[HYPIXEL API AUX 2]: ratelimit hit: ${limit} requests. Until: ${reset.toLocaleTimeString('de-DE')}`))
	.on('reset', () => logger.info('[HYPIXEL API AUX 2]: ratelimit reset'));

module.exports = hypixel;
