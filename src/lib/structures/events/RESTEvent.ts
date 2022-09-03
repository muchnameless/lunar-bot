import { Event, type EventContext } from './Event.js';

export class RESTEvent extends Event {
	public constructor(context: EventContext) {
		super(context);

		this.emitter = this.client.rest;
	}
}
