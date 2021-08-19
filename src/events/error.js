import { logger } from '../functions/index.js';
import { Event } from '../structures/events/Event.js';


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
