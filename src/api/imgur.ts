import { env } from 'node:process';
import { redis } from './index.js';
import { RedisKey } from '#constants';
import { days, seconds } from '#functions';
import { ImgurClient } from '#structures/ImgurClient.js';

export const imgur = new ImgurClient(env.IMGUR_CLIENT_ID!, {
	timeout: seconds(20),
	retries: 1,
	rateLimitedWaitTime: seconds(1),
	cache: {
		async get(key) {
			return JSON.parse((await redis.get(`${RedisKey.Imgur}:${key}`))!) as unknown;
		},
		async set(key, value) {
			return redis.psetex(`${RedisKey.Imgur}:${key}`, days(1), JSON.stringify(value));
		},
	},
});
