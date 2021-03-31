'use strict';

const cacheManager = require('cache-manager');
const redisStore = require('cache-manager-redis');
const logger = require('../functions/logger');


const cache = cacheManager.caching({
	store: redisStore,
	host: 'localhost', // default value
	port: 6379, // default value
	db: 0,
	ttl: 600,
});

cache.store.events.on('redisError', error => logger.error(error));

module.exports = cache;
