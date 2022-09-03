import process, { exit } from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';
import { imgur, redis } from '#api';
import { sequelize, sql } from '#db';
import { seconds } from '#functions';
import { logger } from '#logger';
import { jobs } from '#root/jobs/index.js';

/**
 * error messages which will only be logged when not being caught
 */
export const IGNORED_ERRORS: string[] = [];

process
	.on('unhandledRejection', (error, promise) => {
		logger.error({ err: error, promise }, '[UNCAUGHT PROMISE REJECTION]');
	})
	.once('uncaughtException', (error, origin) => {
		// eslint-disable-next-line sonarjs/no-empty-collection
		if (IGNORED_ERRORS.includes(error?.message ?? error)) {
			logger.error({ err: error, origin }, '[UNCAUGHT EXCEPTION]');
			return;
		}

		logger.fatal({ err: error, origin }, '[UNCAUGHT EXCEPTION]');
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

async function cleanup() {
	let hasError = false;

	try {
		await imgur.cacheRateLimits();
	} catch (error) {
		logger.fatal(error);
		hasError = true;
	}

	for (const output of await Promise.allSettled([
		sequelize.close(),
		sql.end({ timeout: 5 }),
		redis.quit(),
		jobs.stop(),
	])) {
		if (output.status === 'rejected') {
			logger.fatal(output.reason);
			hasError = true;
		} else if (typeof output.value !== 'undefined') {
			logger.info(output.value);
		}
	}

	return hasError;
}

/**
 * closes all db connections and exits the process
 *
 * @param code - exit code
 */
export async function exitProcess(code = 0) {
	const hasError = await Promise.race([cleanup(), sleep(seconds(10), true)]);

	return exit(hasError ? 1 : code);
}
