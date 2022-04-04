import { logger } from '../logger';
import { exitProcess } from '../process';
import { Event, type EventContext } from '../structures/events/Event';

export default class InvalidatedEvent extends Event {
	constructor(context: EventContext) {
		super(context, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 */
	override run() {
		logger.warn('[INVALIDATED]: the client became invalidated');
		void exitProcess(1);
	}
}
