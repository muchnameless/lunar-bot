'use strict';

const ms = require('ms');
const { fetchur: { items, DAY_0, INTERVAL } } = require('../constants/skyblock');


module.exports = () => {
	const TIME = (Date.now() - DAY_0) / INTERVAL;
	const TIME_FLOORED = Math.floor(TIME);

	return {
		item: items[TIME_FLOORED % items.length],
		timeLeft: ms(
			(1 + TIME_FLOORED - TIME) * INTERVAL,
			{ long: true },
		),
	};
};
