import { Event, type EventContext } from '../structures/events/Event';

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
	override async run() {
		// do stuff
	}
}
