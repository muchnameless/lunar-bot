import { Event } from '../structures/events/Event';
import type { EventContext } from '../structures/events/BaseEvent';


export default class MyEvent extends Event {
	constructor(context: EventContext) {
		super(context, {
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
