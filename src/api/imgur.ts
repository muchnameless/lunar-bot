import { env } from 'node:process';
import { ImgurClient } from '../structures/ImgurClient';
import { hours, seconds } from '../functions';
import { RedisKey } from '../constants';
import { redis } from '.';

export const imgur = new ImgurClient(env.IMGUR_CLIENT_ID!, {
	timeout: seconds(20),
	retries: 1,
	rateLimitedWaitTime: seconds(1),
	cache: {
		async get(key) {
			return JSON.parse((await redis.get(`${RedisKey.Imgur}:${key}`))!) as unknown;
		},
		set(key, value) {
			return redis.psetex(`${RedisKey.Imgur}:${key}`, hours(24), JSON.stringify(value));
		},
	},
});
