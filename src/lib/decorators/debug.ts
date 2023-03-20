import { SnowflakeUtil } from 'discord.js';
import { logger } from '#logger';

export function debug<This, Args extends any[], Return>(
	target: (this: This, ...args: Args) => Return,
	context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
) {
	function replacementMethod(this: This, ...args: Args): Return {
		const log = {
			args,
			snowflake: SnowflakeUtil.generate(),
			methodName: context.name,
		};

		logger.debug(log, 'calling');

		try {
			return target.call(this, ...args);
		} finally {
			logger.debug(log, 'exiting');
		}
	}

	return replacementMethod;
}
