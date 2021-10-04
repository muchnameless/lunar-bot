import { cache } from './cache';
import { IMGUR_KEY } from '../constants';
import { ImgurClient } from '../structures/ImgurClient';


export const imgur = new ImgurClient(process.env.IMGUR_CLIENT_ID!, {
	timeout: 20_000,
	retries: 1,
	rateLimitedWaitTime: 1_000,
	cache: {
		get(key) {
			return cache.get(`${IMGUR_KEY}:${key}`);
		},
		set(key, value) {
			return cache.set(`${IMGUR_KEY}:${key}`, value, 10 * 60_000);
		},
	},
});
