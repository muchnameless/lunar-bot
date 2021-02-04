'use strict';

const { createLogger, transports, format } = require('winston');
const util = require('util');
const chalk = require('chalk');

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

logger.on('error', error => {
	console.error(error);
	process.kill(process.pid, 'SIGINT');
});


// extending log method of logger to suppport single argument in log function.
const log = (...input) => {
	if (input.length > 1) {
		const level = input.shift();
		input.forEach(arg => logger.log(level, util.format(arg)));
	} else {
		logger.info(util.format(input[0]));
	}
	return null;
};

const error = (...input) => {
	input.forEach(i => logger.error(util.format(i)));
	return null;
};

const warn = (...input) => {
	input.forEach(i => logger.warn(util.format(i)));
	return null;
};

const info = (...input) => {
	input.forEach(i => logger.info(util.format(i)));
	return null;
};

const debug = (...input) => {
	input.forEach(i => logger.debug(util.format(i)));
	return null;
};

module.exports = {
	error, // logger.error.bind(logger) <- returns logger instead of null,
	warn,
	info,
	debug,
	log,
	logger,
};
