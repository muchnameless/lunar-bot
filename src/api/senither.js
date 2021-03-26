'use strict';

const SenitherAPIFacade = require('../structures/SenitherAPIFacade');
const { multiCache } = require('./cache');
const logger = require('../functions/logger');


const senither = new SenitherAPIFacade(process.env.HYPIXEL_KEY_AUX, {
	cache: {
		// these don't need to be async since cache.get / cache.set will return a promise
		get(key) {
			return multiCache.get(`senither:${key}`);
		},
		set(key, value) {
			// prepend our key with "senither" so we don't conflict with anyone else
			return multiCache.set(`senither:${key}`, value, { ttl: 10 });
		},
	},
});

senither
	.on('limited', (limit, reset) => logger.warn(`[SENITHER]: ratelimit hit: ${limit} requests. Until: ${reset.toLocaleTimeString('de-DE')}`))
	.on('reset', () => logger.info('[SENITHER]: ratelimit reset'));

module.exports = senither;
