import { cache } from './cache';
import { MOJANG_KEY } from '../constants';
import { MojangClient } from '../structures/MojangClient';
import { days, hours, minutes, seconds } from '../functions';
import type { MojangResult } from '../structures/MojangClient';


export const mojang = new MojangClient({
	timeout: seconds(30),
	retries: 1,
	cache: {
		get(key) {
			return cache.get(`${MOJANG_KEY}:${key}`) as Promise<MojangResult | undefined>;
		},
		set(key, value, isError = false) {
			let ttl = minutes(5);

			// 24 hours for successful requests (changed IGNs are reserved for 37 days (30 days name change cooldown + 1 week))
			if (isError) {
				ttl = minutes(1);
			} else if (key.startsWith('ign')) {
				ttl = days(1);
			} else if (key.startsWith('uuid')) {
				ttl = hours(1);
			}

			return cache.set(`${MOJANG_KEY}:${key}`, value, ttl);
		},
	},
});
