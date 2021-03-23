'use strict';

const apiCache = require('./cache');
const Mojang = require('../structures/Mojang');


const mojang = new Mojang({
	cache: {
		get(key) {
			return apiCache.get(`mojang:${key}`);
		},
		set(key, value) {
			// ttl: seconds until cache sweep
			return apiCache.set(`mojang:${key}`, value, { ttl: (typeof value === 'string' ? 4 : 30) * 60 });
		},
	},
});

module.exports = mojang;
