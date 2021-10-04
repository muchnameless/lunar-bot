import { cache } from './cache';
import { MARO_KEY } from '../constants';
import { MaroClient } from '../structures/MaroClient';


export const maro = new MaroClient({
	timeout: 20_000,
	retries: 1,
	cache: {
		get(key) {
			return cache.get(`${MARO_KEY}:${key}`);
		},
		set(key, value) {
			return cache.set(`${MARO_KEY}:${key}`, value, 60_000);
		},
	},
});
