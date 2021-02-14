'use strict';

const ms = require('ms');
const { Constants } = require('discord.js');
const LunarClient = require('../structures/LunarClient');
const logger = require('../functions/logger');


/**
 * rateLimit
 * @param {LunarClient} client
 * @param {Object} rateLimitInfo Object containing the rate limit info
 * @param {number} rateLimitInfo.timeout Timeout in ms
 * @param {number} rateLimitInfo.limit Number of requests that can be made to this endpoint
 * @param {string} rateLimitInfo.method HTTP method used for request that triggered this event
 * @param {string} rateLimitInfo.path Path used for request that triggered this event
 * @param {string} rateLimitInfo.route Route used for request that triggered this event
 */
module.exports = (client, rateLimitInfo) => {
	if (rateLimitInfo.method === 'put' && rateLimitInfo.route.includes('reaction')) return; // reaction add rateLimit fires everytime the bot reacts with multiple emojis

	logger.warn(`[RATE LIMIT]: timeout: ${ms(rateLimitInfo.timeout)}, method: ${rateLimitInfo.method}, path: ${rateLimitInfo.path}`);
};
