import { pino } from 'pino';
// import { inspect } from 'node:util';
// import chalk from 'chalk';

// const _logger = pino();

export const logger = pino();

// const _formatText = ({ timestamp, level, message }: TransformableInfo) => {
// 	let colour;

// 	switch (level) {
// 		case 'error':
// 			colour = chalk.red;
// 			break;

// 		case 'warn':
// 			colour = chalk.yellow;
// 			break;

// 		case 'info':
// 			colour = chalk.green;
// 			break;

// 		case 'debug':
// 			colour = chalk.blue;
// 			break;

// 		default:
// 			colour = (x: string) => x;
// 	}

// 	return `[${timestamp}] [${colour(level.toUpperCase())}]: ${message}`;
// };

// export const _logger = createLogger({
// 	transports: [
// 		new transports.Console({
// 			stderrLevels: [ 'error' ],
// 		}),
// 	],
// 	format: format.combine(
// 		format.timestamp({
// 			format: 'DD.MM.YYYY HH:mm:ss',
// 		}),
// 		format.printf(_formatText),
// 	),
// 	exitOnError: false,
// 	level: 'debug',
// });


// const _formatInput = (input: string | unknown) => (typeof input === 'string'
// 	? input
// 	: inspect(
// 		input,
// 		{
// 			depth: 3,
// 			colors: true,
// 		},
// 	)
// );

// /**
//  * extending log method of logger to suppport single argument in log function.
//  */
// export function error(...input: unknown[]) {
// 	for (const i of input) _logger.error(_formatInput(i));
// 	return null;
// }

// export function warn(...input: unknown[]) {
// 	for (const i of input) _logger.warn(_formatInput(i));
// 	return null;
// }

// export function info(...input: unknown[]) {
// 	for (const i of input) _logger.info(_formatInput(i));
// 	return null;
// }

// export function debug(...input: unknown[]) {
// 	for (const i of input) _logger.debug(_formatInput(i));
// 	return null;
// }
