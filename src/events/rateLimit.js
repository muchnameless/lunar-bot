'use strict';

const ms = require('ms');
const logger = require('../functions/logger');


module.exports = (client, rateLimitInfo) => {
	if (rateLimitInfo.method === 'put' && rateLimitInfo.route.includes('reaction')) return; // reaction add rateLimit fires everytime the bot reacts with multiple emojis

	logger.warn(`[RATE LIMIT]: timeout: ${ms(rateLimitInfo.timeout)}, method: ${rateLimitInfo.method}, path: ${rateLimitInfo.path}`);
};
