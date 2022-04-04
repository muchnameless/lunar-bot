import { logger } from '../logger';
import { Event, type EventContext } from '../structures/events/Event';

export default class WarnEvent extends Event {
	constructor(context: EventContext) {
		super(context, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param warning
	 */
	override run(warning: string) {
		logger.warn(warning);
	}
}
