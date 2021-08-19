import ms from 'ms';
import { logger } from '../functions/index.js';
import { Event } from '../structures/events/Event.js';


export default class RateLimitEvent extends Event {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param {import('discord.js').RateLimitData} rateLimitData
	 */
	async run(rateLimitData) {
		if (rateLimitData.global) return logger.error('[GLOBAL RATELIMIT]', { timeoutHRF: ms(rateLimitData.timeout), ...rateLimitData });

		// adding and removing single reactions are 1/250ms, so get rate limited each time
		if (rateLimitData.route.endsWith('reactions') && rateLimitData.timeout <= 250 + this.client.options.restTimeOffset) return;

		logger.warn('[RATE LIMIT]', { timeoutHRF: ms(rateLimitData.timeout), ...rateLimitData });
	}
}
