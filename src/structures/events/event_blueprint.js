import { Event } from '../structures/events/Event.js';


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
