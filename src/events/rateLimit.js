'use strict';

const ms = require('ms');
const logger = require('../functions/logger');


/**
 * rateLimit
 * @param {import('../structures/LunarClient')} client
 * @param {Object} rateLimitInfo Object containing the rate limit info
 * @param {number} rateLimitInfo.timeout Timeout in ms
 * @param {number} rateLimitInfo.limit Number of requests that can be made to this endpoint
 * @param {string} rateLimitInfo.method HTTP method used for request that triggered this event
 * @param {string} rateLimitInfo.path Path used for request that triggered this event
 * @param {string} rateLimitInfo.route Route used for request that triggered this event
 */
module.exports = (client, { route, timeout, method, path }) => {
	if (route.endsWith('reactions') && timeout <= 250) return; // adding and removing single reactions are 1/250ms, so get rate limited each time

	logger.warn(`[RATE LIMIT]: timeout: ${ms(timeout)}, method: ${method}, path: ${path}`);
};
