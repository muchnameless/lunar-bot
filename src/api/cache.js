'use strict';

const Keyv = require('keyv');
const logger = require('../functions/logger');


const keyv = new Keyv(process.env.REDIS_URI, {
	namespace: process.env.NAMESPACE,
	ttl: 10 * 60_000,
});

keyv.on('error', logger.error);


module.exports = keyv;
