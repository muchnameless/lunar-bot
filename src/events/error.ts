import { logger } from '../logger';
import { Event, type EventContext } from '../structures/events/Event';

export default class ErrorEvent extends Event {
	constructor(context: EventContext) {
		super(context, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param error
	 */
	override run(error: Error) {
		logger.error(error, '[CLIENT ERROR]');
	}
}
