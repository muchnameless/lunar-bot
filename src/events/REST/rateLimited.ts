import { RESTEvents, type RestEvents } from 'discord.js';
import ms from 'ms';
import { logger } from '#logger';
import { RESTEvent } from '#structures/events/RESTEvent.js';

export default class extends RESTEvent {
	public override readonly name = RESTEvents.RateLimited;

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
			rateLimitInfo.timeToReset <= 250 + this.client.rest.requestManager.options.offset
		) {
			return;
		}

		logger.warn({ timeoutReadable: ms(rateLimitInfo.timeToReset), ...rateLimitInfo }, '[RATE LIMITED]');
	}
}
