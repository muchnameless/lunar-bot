'use strict';

const cache = require('./cache');
const Mojang = require('../structures/Mojang');


const mojang = new Mojang({
	cache: {
		get(key) {
			return cache.get(`mojang:${key}`);
		},
		set(key, value) { // ttl: seconds until cache sweep
			if (key.startsWith('name')) { // -> getIGN
				return cache.set(`mojang:${key}`, value, { ttl: (typeof value === 'string' ? 1 : 20) * 60 });
			}

			// key.startsWith('id') -> getUUID
			return cache.set(`mojang:${key}`, value, { ttl: (typeof value === 'string' ? 15 : 30) * 60 });
		},
	},
});

module.exports = mojang;
