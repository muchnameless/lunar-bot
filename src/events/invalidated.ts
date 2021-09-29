import { logger } from '../functions';
import { Event } from '../structures/events/Event';
import type { EventContext } from '../structures/events/BaseEvent';


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
	override async run() {
		logger.warn('[INVALIDATED]: the client became invalidated');
		await this.client.exit(1);
	}
}
