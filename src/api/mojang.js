'use strict';

const cache = require('./cache');
const Mojang = require('../structures/Mojang');


const mojang = new Mojang({
	cache: {
		get(key) {
			return cache.get(`mojang:${key}`);
		},
		set(key, value) {
			return cache.set(`mojang:${key}`, value, 24 * 60 * 60_000); // 24 hours (changed IGNs are reserved for 37 days (30 days name change cooldown + 1 week))
		},
	},
});

module.exports = mojang;
