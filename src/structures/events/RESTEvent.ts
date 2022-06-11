import { Event } from './Event';
import type { EventContext } from './Event';

export class RESTEvent extends Event {
	constructor(context: EventContext) {
		super(context);

		this.emitter = this.client.rest;
	}
}
