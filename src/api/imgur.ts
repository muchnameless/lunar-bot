import { IMGUR_KEY } from '../constants';
import { ImgurClient } from '../structures/ImgurClient';
import { hours, seconds } from '../functions';
import { cache } from '.';

export const imgur = new ImgurClient(process.env.IMGUR_CLIENT_ID!, {
	timeout: seconds(20),
	retries: 1,
	rateLimitedWaitTime: seconds(1),
	cache: {
		get(key) {
			return cache.get(`${IMGUR_KEY}:${key}`);
		},
		set(key, value) {
			return cache.set(`${IMGUR_KEY}:${key}`, value, hours(24));
		},
	},
});
