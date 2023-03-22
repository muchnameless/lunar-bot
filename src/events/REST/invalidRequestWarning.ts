import type { RestEvents, RESTEvents } from 'discord.js';
import { logger } from '#logger';
import { RESTEvent } from '#structures/events/RESTEvent.js';

export default class RESTInvalidRequestEvent extends RESTEvent {
	/**
	 * event listener callback
	 *
	 * @param invalidRequestInfo
	 */
	public override run(invalidRequestInfo: RestEvents[RESTEvents.InvalidRequestWarning][0]) {
		logger.warn({ invalidRequestInfo }, '[REST INVALID REQUEST]');
	}
}
