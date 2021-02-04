'use strict';

const cacheManager = require('cache-manager');


const apiCache = cacheManager.caching({ store: 'memory' });

module.exports = apiCache;
