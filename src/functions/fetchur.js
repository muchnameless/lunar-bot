'use strict';

const ms = require('ms');
const tc = require('timezonecomplete');
const { fetchurItems } = require('../constants/skyblock');
// const logger = require('./logger');


/**
 * fetchur resets every day at midnight ET (UTC-4/5) and every month to the start of the list
 */
module.exports = () => {
	const date = new Date();
	const OFFSET = tc.zone('America/New_York').offsetForUtcDate(date) / 60;
	date.setUTCHours(date.getUTCHours() + OFFSET); // EST
	const DAY = date.getUTCDate();

	tc.zone('America/New_York');

	const tomorrow = new Date();
	tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
	tomorrow.setUTCHours(Math.abs(OFFSET), 0, 0, 0);

	const today = new Date();
	today.setUTCHours(Math.abs(OFFSET), 0, 0, 0);

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
