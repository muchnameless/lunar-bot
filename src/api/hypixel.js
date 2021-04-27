'use strict';

const { Client } = require('@zikeji/hypixel');
const cache = require('./cache');
const logger = require('../functions/logger');


const hypixel = new Client(process.env.HYPIXEL_KEY, {
	cache: {
		get(key) {
			return cache.get(`hypixel:${key}`);
		},
		set(key, value) {
			if (key.startsWith('guild')) return; // don't cache guilds

			let ttl;

			if (key.startsWith('skyblock:profile') || key.startsWith('status')) { // profile & profiles
				ttl = 30_000;
			} else if (key.startsWith('player')) {
				ttl = 60_000;
			} else if (key.startsWith('skyblock:auction')) {
				ttl = 4 * 60_000;
			// the following endpoints don't require API keys and won't eat into your rate limit
			} else if (key.startsWith('resources:')) {
				ttl = 24 * 60 * 60_000; // 24 hours as resources don't update often, if at all
			} else if (key === 'skyblock:bazaar') {
				ttl = 10_000; // this endpoint is cached by cloudflare and updates every 10 seconds
			} else if (key.startsWith('skyblock:auctions:')) {
				ttl = 60_000; // this endpoint is cached by cloudflare and updates every 60 seconds
			} else { // default 5 minute ttl
				ttl = 5 * 60_000;
			}

			return cache.set(`hypixel:${key}`, value, ttl);
		},
	},
});

hypixel
	.on('limited', (limit, reset) => logger.warn(`[HYPIXEL API]: ratelimit hit: ${limit} requests. Until: ${reset.toLocaleTimeString('de-DE')}`))
	.on('reset', () => logger.info('[HYPIXEL API]: ratelimit reset'));

module.exports = hypixel;
