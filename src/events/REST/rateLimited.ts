import ms from 'ms';
import { logger } from '../../logger';
import { RESTEvent } from '../../structures/events/RESTEvent';
import type { RateLimitData } from '@discordjs/rest';

export default class RateLimitedEvent extends RESTEvent {
	/**
	 * event listener callback
	 * @param rateLimitInfo
	 */
	override run(rateLimitInfo: RateLimitData) {
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
