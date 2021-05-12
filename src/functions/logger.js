'use strict';

const { createLogger, transports, format } = require('winston');
const util = require('util');
const chalk = require('chalk');

/**
  * @param {{ timestamp: number, level: string, message: string }} param0
  */
const getFormattedText = ({ timestamp, level, message }) => {
	let colour;

	switch (level) {
		case 'error':
			colour = chalk.red;
			break;

		case 'warn':
			colour = chalk.yellow;
			break;

		case 'info':
			colour = chalk.green;
			break;

		case 'debug':
			colour = chalk.blue;
			break;

		default:
			colour = x => x;
	}

	return `[${timestamp}] [${colour(level.toUpperCase())}]: ${message}`;
};

const logger = createLogger({
	transports: [
		new transports.Console({
			stderrLevels: [ 'error' ],
		}),
	],
	format: format.combine(
		format.timestamp({
			format: 'DD.MM.YYYY HH:mm:ss',
		}),
		format.printf(getFormattedText),
	),
	exitOnError: false,
	level: 'debug',
});

logger.on('error', (error) => {
	console.error(error);
	process.kill(process.pid, 'SIGINT');
});


/**
 * extending log method of logger to suppport single argument in log function.
 * @returns {null}
 */
const log = (...input) => {
	if (input.length > 1) {
		const level = input.shift();
		for (const i of input) logger.log(level, util.format(i));
	} else {
		logger.info(util.format(input[0]));
	}
	return null;
};

/**
 * @returns {null}
 */
const error = (...input) => {
	for (const i of input) logger.error(i?.stack && !(i instanceof TypeError || i instanceof RangeError) ? util.format(`${i}`) : util.format(i));
	return null;
};

/**
 * @returns {null}
 */
const warn = (...input) => {
	for (const i of input) logger.warn(util.format(i));
	return null;
};

/**
 * @returns {null}
 */
const info = (...input) => {
	for (const i of input) logger.info(util.format(i));
	return null;
};

/**
 * @returns {null}
 */
const debug = (...input) => {
	for (const i of input) logger.debug(util.format(i));
	return null;
};

module.exports = {
	error,
	warn,
	info,
	debug,
	log,
	logger,
};
