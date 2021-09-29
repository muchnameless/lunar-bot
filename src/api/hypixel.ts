import { cache } from './cache';
import { HYPIXEL_KEY } from '../constants';
import { logger } from '../functions';
import { Client } from '@zikeji/hypixel';
import type { Components, DefaultMeta } from '@zikeji/hypixel';


export const hypixel = new Client(process.env.HYPIXEL_KEY!, {
	timeout: 15_000,
	retries: 1,
	cache: {
		get(key) {
			return cache.get(`${HYPIXEL_KEY}:${key}`) as Promise<Components.Schemas.ApiSuccess & DefaultMeta>;
		},
		// @ts-expect-error return types
		set(key, value) {
			if (key.startsWith('guild')) return; // don't cache guilds

			let ttl;

			if (key.startsWith('skyblock:profiles') || key.startsWith('status')) {
				ttl = 30_000;
			} else if (key.startsWith('skyblock:profile')) {
				ttl = 2 * 60_000;
			} else if (key.startsWith('player') || key.startsWith('skyblock:auction')) {
				ttl = 60_000;
			// the following endpoints don't require API keys and won't eat into your rate limit
			} else if (key.startsWith('resources:')) {
				ttl = 24 * 60 * 60_000; // 24 hours as resources don't update often, if at all
			} else if (key === 'skyblock:bazaar') {
				ttl = 10_000; // this endpoint is cached by cloudflare and updates every 10 seconds
			} else if (key.startsWith('skyblock:auctions:')) {
				ttl = 60_000; // this endpoint is cached by cloudflare and updates every 60 seconds
			} else { // default 5 minute ttl
				ttl = 5 * 60_000;
			}

			return cache.set(`${HYPIXEL_KEY}:${key}`, value, ttl);
		},
	},
});

hypixel
	.on('limited', (limit, reset) => logger.warn(`[HYPIXEL API]: ratelimit hit: ${limit} requests. Until: ${reset.toLocaleTimeString('de-DE')}`))
	.on('reset', () => logger.info('[HYPIXEL API]: ratelimit reset'));
