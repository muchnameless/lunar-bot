import type { RestEvents, RESTEvents } from 'discord.js';
import ms from 'ms';
import { logger } from '#logger';
import { RESTEvent } from '#structures/events/RESTEvent.js';

export default class RateLimitedEvent extends RESTEvent {
	/**
	 * event listener callback
	 *
	 * @param rateLimitInfo
	 */
	public override run(rateLimitInfo: RestEvents[RESTEvents.RateLimited][0]) {
		if (rateLimitInfo.global) {
			return logger.error({ timeoutReadable: ms(rateLimitInfo.timeToReset), ...rateLimitInfo }, '[GLOBAL RATE LIMIT]');
		}

		// adding and removing single reactions are 1/250ms, so get rate limited each time
		if (
			rateLimitInfo.route.endsWith(':reaction') &&
			rateLimitInfo.timeToReset <= 250 + (this.client.options.rest?.offset ?? 50)
		) {
			return;
		}

		logger.warn({ timeoutReadable: ms(rateLimitInfo.timeToReset), ...rateLimitInfo }, '[RATE LIMITED]');
	}
}
