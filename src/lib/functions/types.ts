import { inspect } from 'node:util';
import { logger } from '#logger';

export function assertNever(value: never): never {
	logger.error(new Error(inspect(value)), '[ASSERT NEVER]: unexpected value');

	throw 'unexpected value';
}
