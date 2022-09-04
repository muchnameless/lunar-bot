import { redis } from './index.js';
import { RedisKey } from '#constants';
import { days, hours, minutes } from '#functions';
import { MojangClient, type MojangResult } from '#structures/MojangClient.js';

export const mojang = new MojangClient({
	cache: {
		async get(key): Promise<MojangResult | null> {
			return JSON.parse((await redis.get(`${RedisKey.Mojang}:${key}`))!);
		},
		async set(key, value, isError = false) {
			let ttl = minutes(5);

			// 24 hours for successful requests (changed IGNs are reserved for 37 days (30 days name change cooldown + 1 week))
			if (isError) {
				ttl = minutes(1);
			} else if (key.startsWith('ign')) {
				ttl = days(1);
			} else if (key.startsWith('uuid')) {
				ttl = hours(1);
			}

			return redis.psetex(`${RedisKey.Mojang}:${key}`, ttl, JSON.stringify(value));
		},
	},
});
