'use strict';

const { Client } = require('@zikeji/hypixel');
const cache = require('./cache');
const hypixelTTL = require('./hypixelTTL');
const logger = require('../functions/logger');


const hypixel = new Client(process.env.HYPIXEL_KEY_AUX, {
	cache: {
		// these don't need to be async since cache.get / cache.set will return a promise
		get(key) {
			return cache.get(`hypixel:${key}`);
		},
		set(key, value) {
			if (key.startsWith('guild')) return;

			// prepend our key with "hypixel" so we don't conflict with anyone else
			return cache.set(`hypixel:${key}`, value, hypixelTTL(key));
		},
	},
});

hypixel
	.on('limited', (limit, reset) => logger.warn(`[HYPIXEL API AUX]: ratelimit hit: ${limit} requests. Until: ${reset.toLocaleTimeString('de-DE')}`))
	.on('reset', () => logger.info('[HYPIXEL API AUX]: ratelimit reset'));

module.exports = hypixel;
