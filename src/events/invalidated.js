import { Event } from '../structures/events/Event.js';
import { logger } from '../functions/logger.js';


export default class InvalidatedEvent extends Event {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 */
	async run() {
		logger.warn('[INVALIDATED]: the client became invalidated');
		this.client.exit(1);
	}
}
