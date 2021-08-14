import { Event } from '../structures/events/Event.js';
import { logger } from '../functions/logger.js';


export default class ErrorEvent extends Event {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param {Error} error
	 */
	run(error) {
		logger.error('[CLIENT ERROR]', error);
	}
}
