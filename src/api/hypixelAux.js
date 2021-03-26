'use strict';

const { Client } = require('@zikeji/hypixel');
const { redisCache } = require('./cache');
const logger = require('../functions/logger');


const hypixel = new Client(process.env.HYPIXEL_KEY_AUX, {
	cache: {
		// these don't need to be async since cache.get / cache.set will return a promise
		get(key) {
			return redisCache.get(`hypixel:${key}`);
		},
		set(key, value) {
			if (key.startsWith('guild')) return;

			// default 5 minute ttl - useful for alost of endpoints
			let ttl = 5 * 60;

			if (key.startsWith('skyblock:profile') || key.startsWith('player')) {
				ttl = 20;
			} else if (key.startsWith('skyblock:auction')) {
				ttl = 4 * 60;

			// the following endpoints don't require API keys and won't eat into your rate limit
			} else if (key.startsWith('resources:')) {
				ttl = 24 * 60 * 60; // 24 hours as resources don't update often, if at all
			} else if (key === 'skyblock:bazaar') {
				// this endpoint is cached by cloudflare and updates every 10 seconds
				ttl = 10;
			} else if (key.startsWith('skyblock:auctions:')) {
				// this endpoint is cached by cloudflare and updates every 60 seconds
				ttl = 60;
			}

			// prepend our key with "hypixel" so we don't conflict with anyone else
			return redisCache.set(`hypixel:${key}`, value, { ttl });
		},
	},
});

hypixel
	.on('limited', (limit, reset) => logger.warn(`[HYPIXEL API AUX]: ratelimit hit: ${limit} requests. Until: ${reset.toLocaleTimeString('de-DE')}`))
	.on('reset', () => logger.info('[HYPIXEL API AUX]: ratelimit reset'));

module.exports = hypixel;
