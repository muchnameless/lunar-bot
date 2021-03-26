'use strict';

const { multiCache } = require('./cache');
const Mojang = require('../structures/Mojang');


const mojang = new Mojang({
	cache: {
		get(key) {
			return multiCache.get(`mojang:${key}`);
		},
		set(key, value) {
			// ttl: seconds until cache sweep
			return multiCache.set(`mojang:${key}`, value, { ttl: (typeof value === 'string' ? 4 : 20) * 60 });
		},
	},
});

module.exports = mojang;
