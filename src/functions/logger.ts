import pkg from 'winston';
const { createLogger, transports, format } = pkg;
import { inspect } from 'node:util';
import chalk from 'chalk';
import type { TransformableInfo } from 'logform';


const _formatText = ({ timestamp, level, message }: TransformableInfo) => {
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
			colour = (x: string) => x;
	}

	return `[${timestamp}] [${colour(level.toUpperCase())}]: ${message}`;
};

const _logger = createLogger({
	transports: [
		new transports.Console({
			stderrLevels: [ 'error' ],
		}),
	],
	format: format.combine(
		format.timestamp({
			format: 'DD.MM.YYYY HH:mm:ss',
		}),
		format.printf(_formatText),
	),
	exitOnError: false,
	level: 'debug',
});

_logger.on('error', (error) => {
	console.error(error);
	process.kill(process.pid, 'SIGINT');
});

const _formatInput = (input: string | any) => (typeof input === 'string'
	? input
	: inspect(
		input,
		{
			depth: 3,
			colors: true,
		},
	)
);

/**
 * extending log method of logger to suppport single argument in log function.
 */
const log = (...input: any[]) => {
	if (input.length > 1) {
		const level = input.shift();
		for (const i of input) _logger.log(level, _formatInput(i));
	} else {
		_logger.info(_formatInput(input[0]));
	}
	return null;
};

const error = (...input: any[]) => {
	for (const i of input) _logger.error(_formatInput(i));
	return null;
};

const warn = (...input: any[]) => {
	for (const i of input) _logger.warn(_formatInput(i));
	return null;
};

const info = (...input: any[]) => {
	for (const i of input) _logger.info(_formatInput(i));
	return null;
};

const debug = (...input: any[]) => {
	for (const i of input) _logger.debug(_formatInput(i));
	return null;
};

export const logger = {
	error,
	warn,
	info,
	debug,
	log,
	_logger,
};
