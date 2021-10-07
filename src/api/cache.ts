import Keyv from 'keyv';
import { logger, minutes } from '../functions';


export const cache = new Keyv<unknown>(process.env.REDIS_URI, {
	namespace: process.env.NAMESPACE,
	ttl: minutes(10),
});

cache.on('error', error => logger.error(error));
