import { cache } from './cache';
import { MOJANG_KEY } from '../constants';
import { MojangClient } from '../structures/MojangClient';
import type { MojangResult } from '../structures/MojangClient';


export const mojang = new MojangClient({
	timeout: 30_000,
	retries: 1,
	cache: {
		get(key) {
			return cache.get(`${MOJANG_KEY}:${key}`) as Promise<MojangResult | undefined>;
		},
		set(key, value) {
			let ttl = 5 * 60_000;

			// 24 hours for successful requests (changed IGNs are reserved for 37 days (30 days name change cooldown + 1 week))
			if (key.startsWith('ign')) {
				ttl = 24 * 60 * 60_000;
			} else if (key.startsWith('uuid')) {
				ttl = 60 * 60_000;
			} else if (value.error) { // 1 hour for errors
				ttl = 60 * 60_000;
			}

			return cache.set(`${MOJANG_KEY}:${key}`, value, ttl);
		},
	},
});
