import { Event } from '../structures/events/Event.js';
import { logger } from '../functions/logger.js';


export default class WarnEvent extends Event {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param {string} warning
	 */
	async run(warning) {
		logger.warn(warning);
	}
}
