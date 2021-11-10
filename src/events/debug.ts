import { logger } from '../functions';
import { Event } from '../structures/events/Event';
import type { EventContext } from '../structures/events/BaseEvent';

export default class DebugEvent extends Event {
	constructor(context: EventContext) {
		super(context, {
			once: false,
			enabled: false,
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
