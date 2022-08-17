import { env } from 'node:process';
import { Client } from '@zikeji/hypixel';
import { logger } from '#logger';
import { RedisKey } from '#constants';
import { days, minutes, seconds } from '#functions';
import { redis } from '.';
import type { Components, DefaultMeta } from '@zikeji/hypixel';

export const SKYBLOCK_PROFILE_TTL = seconds(30);

export const hypixel = new Client(env.HYPIXEL_KEY!, {
	timeout: seconds(15),
	rateLimitResetOffset: seconds(1),
	retries: 1,
	cache: {
		async get<T>(key: string): Promise<(T & DefaultMeta) | null> {
			return JSON.parse((await redis.get(`${RedisKey.Hypixel}:${key}`))!);
		},
		set(key, value) {
			let ttl = minutes(5); // default 5 minute ttl

			if (key.startsWith('skyblock:profiles')) {
				ttl = SKYBLOCK_PROFILE_TTL;
			} else if (
				key.startsWith('guild') ||
				key.startsWith('player') ||
				key.startsWith('skyblock:auction') ||
				key.startsWith('skyblock:profile')
			) {
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
			}

			return redis.psetex(`${RedisKey.Hypixel}:${key}`, ttl, JSON.stringify(value));
		},
	},
});

hypixel
	.on('limited', (limit, reset) =>
		logger.warn(`[HYPIXEL API]: ratelimit hit: ${limit} requests. Until: ${reset.toLocaleTimeString('de-DE')}`),
	)
	.on('reset', () => logger.info('[HYPIXEL API]: ratelimit reset'));

export const getSkyBlockProfiles = async (uuid: string) =>
	((await hypixel.skyblock.profiles.uuid(uuid)).profiles?.filter(Boolean) ?? null) as
		| NonNullable<Components.Schemas.SkyBlockProfileCuteName>[]
		| null;
