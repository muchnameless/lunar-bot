'use strict';

/**
 * determines the cache ttl based on the API route
 * @param {string} key
 */
module.exports = (key) => {
	if (key.startsWith('player')) return 10_000;
	if (key.startsWith('skyblock:profile'))	return 30_000;
	if (key.startsWith('skyblock:auction')) return 4 * 60_000;

	// the following endpoints don't require API keys and won't eat into your rate limit
	if (key.startsWith('resources:')) return 24 * 60 * 60_000; // 24 hours as resources don't update often, if at all
	if (key === 'skyblock:bazaar') return 10_000; // this endpoint is cached by cloudflare and updates every 10 seconds
	if (key.startsWith('skyblock:auctions:')) return 60_000; // this endpoint is cached by cloudflare and updates every 60 seconds

	// default 5 minute ttl - useful for alost of endpoints
	return 5 * 60_000;
};
