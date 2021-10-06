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
			return cache.set(`${MARO_KEY}:${key}`, value, minutes(1));
		},
	},
});
