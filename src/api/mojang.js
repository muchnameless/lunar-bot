'use strict';

const { multiCache, redisCache } = require('./cache');
const Mojang = require('../structures/Mojang');


const mojang = new Mojang({
	cache: {
		get(key) {
			return multiCache.get(`mojang:${key}`);
		},
		set(key, value) { // ttl: seconds until cache sweep
			if (key.startsWith('name')) { // -> getIGN
				return redisCache.set(`mojang:${key}`, value, { ttl: (typeof value === 'string' ? 1 : 20) * 60 });
			}

			// key.startsWith('id') -> getUUID
			return multiCache.set(`mojang:${key}`, value, { ttl: (typeof value === 'string' ? 15 : 30) * 60 });
		},
	},
});

module.exports = mojang;
