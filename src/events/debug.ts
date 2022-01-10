import process from 'node:process';
import { logger } from '../functions';
import { Event, type EventContext } from '../structures/events/Event';

export default class DebugEvent extends Event {
	constructor(context: EventContext) {
		super(context, {
			once: false,
			enabled: process.env.NODE_ENV === 'development',
		});
	}

	/**
	 * event listener callback
	 * @param info
	 */
	override run(info: string) {
		logger.debug(info);
	}
}
