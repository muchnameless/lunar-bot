'use strict';

const cache = require('./cache');
const Mojang = require('../structures/Mojang');


const mojang = new Mojang({
	cache: {
		get(key) {
			return cache.get(`mojang:${key}`);
		},
		set(key, value) {
			return cache.set(`mojang:${key}`, value, 3 * 60 * 60_000); // 3 hours
		},
	},
});

module.exports = mojang;
