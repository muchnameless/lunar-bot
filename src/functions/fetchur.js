'use strict';

const ms = require('ms');
const { fetchurItems } = require('../constants/skyblock');
// const logger = require('./logger');


/**
 * fetchur resets every day at midnight EST (UTC-5) and every month to the start of the list
 */
module.exports = () => {
	const date = new Date();
	date.setUTCHours(date.getUTCHours() - 5); // EST
	const DAY = date.getUTCDate();

	const tomorrow = new Date();
	tomorrow.setDate(tomorrow.getDate() + 1);
	tomorrow.setUTCHours(5, 0, 0, 0);

	const today = new Date();
	today.setUTCHours(5, 0, 0, 0);

	const RESET_TIME = Math.min(
		...[
			tomorrow.getTime() - Date.now(),
			today.getTime() - Date.now(),
		].filter(time => time >= 0),
	);

	return {
		item: fetchurItems[(DAY - 1) % fetchurItems.length],
		timeLeft: ms(
			RESET_TIME,
			{ long: true },
		),
	};
};
