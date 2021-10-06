import { Client } from '@zikeji/hypixel';
import { cache } from './cache';
import { HYPIXEL_KEY } from '../constants';
import { days, logger, minutes, seconds } from '../functions';
import type { DefaultMeta } from '@zikeji/hypixel';


export const hypixel = new Client(process.env.HYPIXEL_KEY!, {
	timeout: seconds(15),
	retries: 1,
	cache: {
		get<T>(key: string) {
			return cache.get(`${HYPIXEL_KEY}:${key}`) as Promise<T & DefaultMeta>;
		},
		// @ts-expect-error return types
		set(key, value) {
			if (key.startsWith('guild')) return; // don't cache guilds

			let ttl;

			if (key.startsWith('skyblock:profiles') || key.startsWith('player') || key.startsWith('skyblock:auction')) {
				ttl = minutes(1);
			} else if (key.startsWith('skyblock:profile')) {
				ttl = minutes(2);
			} else if (key.startsWith('status')) {
				ttl = seconds(20);
			// the following endpoints don't require API keys and won't eat into your rate limit
			} else if (key.startsWith('resources:')) {
				ttl = days(1); // 24 hours as resources don't update often, if at all
			} else if (key === 'skyblock:bazaar') {
				ttl = seconds(10); // this endpoint is cached by cloudflare and updates every 10 seconds
			} else if (key.startsWith('skyblock:auctions:')) {
				ttl = minutes(1); // this endpoint is cached by cloudflare and updates every 60 seconds
			} else { // default 5 minute ttl
				ttl = minutes(5);
			}

			return cache.set(`${HYPIXEL_KEY}:${key}`, value, ttl);
		},
	},
});

hypixel
	.on('limited', (limit, reset) => logger.warn(`[HYPIXEL API]: ratelimit hit: ${limit} requests. Until: ${reset.toLocaleTimeString('de-DE')}`))
	.on('reset', () => logger.info('[HYPIXEL API]: ratelimit reset'));
