import { Event } from './Event';
import type { EventContext } from './Event';
import type { EventData } from './BaseEvent';

export class RESTEvent extends Event {
	constructor(context: EventContext, data: EventData) {
		super(context, data);

		this.emitter = this.client.rest;
	}
}
