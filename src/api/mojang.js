'use strict';

const cache = require('./cache');
const Mojang = require('../structures/Mojang');


const mojang = new Mojang({
	cache: {
		get(key) {
			return cache.get(`mojang:${key}`);
		},
		set(key, value) {
			return cache.set(`mojang:${key}`, value, 30 * 60_000);
		},
	},
});

module.exports = mojang;
