'use strict';

const ms = require('ms');
const { fetchur: { items, DAY_0, INTERVAL } } = require('../constants/skyblock');


module.exports = () => {
	const NOW = Date.now();
	const TIME = (NOW - DAY_0) / INTERVAL;

	return {
		item: items[Math.floor(TIME) % items.length],
		timeLeft: ms(
			(1 - TIME + Math.floor(TIME)) * INTERVAL,
			{ long: true },
		),
	};
};
