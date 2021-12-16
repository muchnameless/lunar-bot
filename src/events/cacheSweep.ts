import { Event } from '../structures/events/Event';
import { logger } from '../functions';
import type { EventContext } from '../structures/events/BaseEvent';

export default class CacheSweepEvent extends Event {
	constructor(context: EventContext) {
		super(context, {
			once: false,
			enabled: process.env.NODE_ENV === 'development',
		});
	}

	/**
	 * event listener callback
	 * @param message
	 */
	override run(message: string) {
		logger.trace(`[SWEEPERS]: ${message}`);
	}
}
