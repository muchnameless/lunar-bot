import { Event } from '../structures/events/Event.js';
// import { logger } from '../functions/logger.js';


export default class MyEvent extends Event {
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
		// do stuff
	}
}
