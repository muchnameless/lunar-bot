import { SnowflakeUtil } from 'discord.js';
import { logger } from '#logger';

/**
 * adds debug logging to method calls
 */
export function debug<This, Args extends any[], Return>(
	target: (this: This, ...args: Args) => Return,
	context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
) {
	function debugReplacementMethod(this: This, ...args: Args): Return {
		const log = {
			args,
			snowflake: SnowflakeUtil.generate(),
			methodName: context.name,
		};

		logger.debug(log, 'calling');

		try {
			const returnValue = target.call(this, ...args);

			logger.debug({ ...log, returnValue }, 'success');

			return returnValue;
		} catch (error) {
			logger.debug({ ...log, error }, 'error');

			throw error;
		}
	}

	return debugReplacementMethod;
}
