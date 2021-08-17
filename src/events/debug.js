import { Event } from '../structures/events/Event.js';
import { logger } from '../functions/logger.js';


export default class DebugEvent extends Event {
	constructor(data) {
		super(data, {
			once: false,
			enabled: false,
		});
	}

	/**
	 * event listener callback
	 * @param {string} info
	 */
	async run(info) {
		logger.debug(info);
	}
}
