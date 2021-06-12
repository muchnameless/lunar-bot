'use strict';

const { createLogger, transports, format } = require('winston');
const { inspect } = require('util');
const chalk = require('chalk');


class Logger {
	constructor() {
		/**
		 * @type {import('winston').Logger}
		 */
		this._logger = createLogger({
			transports: [
				new transports.Console({
					stderrLevels: [ 'error' ],
				}),
			],
			format: format.combine(
				format.timestamp({
					format: 'DD.MM.YYYY HH:mm:ss',
				}),
				format.printf(Logger._formatText),
			),
			exitOnError: false,
			level: 'debug',
		})
			.on('error', (error) => {
				console.error(error);
				process.kill(process.pid, 'SIGINT');
			});

		this.depth = Logger.DEFAULT_DEPTH;
	}

	static DEFAULT_DEPTH = 3;

	/**
	 * @param {import('logform').TransformableInfo} param0
	 */
	static _formatText = ({ timestamp, level, message }) => {
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
	}

	/**
	 * strinigifies the input, inspecting non-strings
	 * @param {*} input
	 */
	_formatInput(input) {
		return typeof input === 'string'
			? input
			: inspect(
				input,
				{
					depth: this.depth,
					colors: true,
				},
			);
	}


	/**
	 * extending log method of logger to suppport single argument in log function.
	 * @returns {null}
	 */
	log(...input) {
		if (input.length > 1) {
			const level = input.shift();
			for (const i of input) this._logger.log(level, this._formatInput(i));
		} else {
			this._logger.info(this._formatInput(input[0]));
		}
		return null;
	}

	/**
	 * @returns {null}
	 */
	error(...input) {
		for (const i of input) this._logger.error(this._formatInput(i));
		return null;
	}

	/**
	 * @returns {null}
	 */
	warn(...input) {
		for (const i of input) this._logger.warn(this._formatInput(i));
		return null;
	}

	/**
	 * @returns {null}
	 */
	info(...input) {
		for (const i of input) this._logger.info(this._formatInput(i));
		return null;
	}

	/**
	 * @returns {null}
	 */
	debug(...input) {
		for (const i of input) this._logger.debug(this._formatInput(i));
		return null;
	}
}

module.exports = new Logger();
