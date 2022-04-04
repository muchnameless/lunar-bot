import process, { exit } from 'node:process';
import { imgur, redis } from './api';
import { bree } from './jobs';
import { sequelize, sql } from './structures/database';
import { logger } from './logger';

process
	.on('unhandledRejection', (error) => {
		logger.error(error, '[UNCAUGHT PROMISE REJECTION]');
	})
	.once('uncaughtException', (error) => {
		logger.fatal(error, '[UNCAUGHT EXCEPTION]');
		void exitProcess(-1);
	})
	.once('SIGINT', () => {
		logger.fatal('[SIGINT]');
		void exitProcess(0);
	})
	.once('SIGTERM', () => {
		logger.fatal('[SIGTERM]');
		void exitProcess(0);
	});

/**
 * closes all db connections and exits the process
 * @param code exit code
 */
export async function exitProcess(code = 0) {
	let hasError = false;

	try {
		await imgur.cacheRateLimits();
	} catch (error) {
		logger.fatal(error);
	}

	for (const output of await Promise.allSettled([sequelize.close(), sql.end(), redis.quit(), bree?.stop()])) {
		if (output.status === 'rejected') {
			logger.fatal(output.reason);
			hasError = true;
		} else if (typeof output.value !== 'undefined') {
			logger.info(output.value);
		}
	}

	return exit(hasError ? 1 : code);
}
