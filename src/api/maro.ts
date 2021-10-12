import { cache } from './cache';
import { MARO_KEY } from '../constants';
import { MaroClient } from '../structures/MaroClient';
import { minutes, seconds } from '../functions';


export const maro = new MaroClient({
	timeout: seconds(20),
	retries: 1,
	cache: {
		get(key) {
			return cache.get(`${MARO_KEY}:${key}`);
		},
		set(key, value) {
			let ttl = minutes(1);

			// cached error -> same time as cached profile
			if (Reflect.has(value as Record<string, string>, 'cause')) {
				ttl = seconds(30);
			}

			return cache.set(`${MARO_KEY}:${key}`, value, ttl);
		},
	},
});
