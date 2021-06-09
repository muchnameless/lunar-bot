'use strict';

const { createLogger, transports, format } = require('winston');
const { inspect } = require('util');
const chalk = require('chalk');

/**
  * @param {import('logform').TransformableInfo} param0
  */
const formatText = ({ timestamp, level, message }) => {
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
		format.printf(formatText),
	),
	exitOnError: false,
	level: 'debug',
});

logger.on('error', (error) => {
	console.error(error);
	process.kill(process.pid, 'SIGINT');
});

const formatInput = input => (typeof input === 'string'
	? input
	: inspect(
		input,
		{
			depth: null,
			colors: true,
		},
	)
);

/**
 * extending log method of logger to suppport single argument in log function.
 * @returns {null}
 */
const log = (...input) => {
	if (input.length > 1) {
		const level = input.shift();
		for (const i of input) logger.log(level, formatInput(i));
	} else {
		logger.info(formatInput(input[0]));
	}
	return null;
};

/**
 * @returns {null}
 */
const error = (...input) => {
	for (const i of input) logger.error(formatInput(i));
	return null;
};

/**
 * @returns {null}
 */
const warn = (...input) => {
	for (const i of input) logger.warn(formatInput(i));
	return null;
};

/**
 * @returns {null}
 */
const info = (...input) => {
	for (const i of input) logger.info(formatInput(i));
	return null;
};

/**
 * @returns {null}
 */
const debug = (...input) => {
	for (const i of input) logger.debug(formatInput(i));
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
