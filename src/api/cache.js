'use strict';

const cacheManager = require('cache-manager');
const redisStore = require('cache-manager-redis');
const logger = require('../functions/logger');


const memoryCache = cacheManager.caching({
	store: 'memory',
	max: 100,
	ttl: 60,
});

const redisCache = cacheManager.caching({
	store: redisStore,
	host: 'localhost', // default value
	port: 6379, // default value
	db: 0,
	ttl: 600,
});

redisCache.store.events.on('redisError', error => logger.error(error));

const apiCache = cacheManager.multiCaching([ memoryCache, redisCache ]);

module.exports = apiCache;
