import Keyv from 'keyv';
import { logger } from '../functions';


export const cache = new Keyv<unknown>(process.env.REDIS_URI, {
	namespace: process.env.NAMESPACE,
	ttl: 10 * 60_000,
});

cache.on('error', logger.error);
