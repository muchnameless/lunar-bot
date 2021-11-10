import ms from 'ms';
import { logger } from '../functions';
import { Event } from '../structures/events/Event';
import type { RateLimitData } from 'discord.js';
import type { EventContext } from '../structures/events/BaseEvent';

export default class RateLimitEvent extends Event {
	constructor(context: EventContext) {
		super(context, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param rateLimitData
	 */
	override run(rateLimitData: RateLimitData) {
		if (rateLimitData.global)
			return logger.error({ timeoutHRF: ms(rateLimitData.timeout), ...rateLimitData }, '[GLOBAL RATELIMIT]');

		// adding and removing single reactions are 1/250ms, so get rate limited each time
		if (rateLimitData.route.endsWith('reactions') && rateLimitData.timeout <= 250 + this.client.options.restTimeOffset!)
			return;

		logger.warn({ timeoutHRF: ms(rateLimitData.timeout), ...rateLimitData }, '[RATE LIMIT]');
	}
}
