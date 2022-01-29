import { env } from 'node:process';
import Keyv from 'keyv';
import { logger, minutes } from '../functions';

export const cache = new Keyv<unknown>(env.REDIS_URI, {
	namespace: env.NAMESPACE,
	ttl: minutes(10),
});

cache.on('error', (error) => logger.error(error));
