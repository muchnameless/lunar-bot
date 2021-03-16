'use strict';

const ms = require('ms');
const { fetchurItems } = require('../constants/skyblock');
// const logger = require('./logger');

const OFFSET = 4;

/**
 * fetchur resets every day at midnight EST (UTC-5) and every month to the start of the list
 */
module.exports = () => {
	const date = new Date();
	date.setUTCHours(date.getUTCHours() - OFFSET); // EST
	const DAY = date.getUTCDate();

	const tomorrow = new Date();
	tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
	tomorrow.setUTCHours(OFFSET, 0, 0, 0);

	const today = new Date();
	today.setUTCHours(OFFSET, 0, 0, 0);

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
