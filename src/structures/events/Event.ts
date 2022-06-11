import { BaseEvent } from './BaseEvent';
import type { BaseEventContext } from './BaseEvent';
import type { LunarClient } from '../LunarClient';

export interface EventContext extends BaseEventContext {
	emitter: LunarClient;
}

export class Event extends BaseEvent {
	client: LunarClient;

	constructor(context: EventContext) {
		super(context);

		this.client = context.emitter;
	}

	/**
	 * client config
	 */
	get config() {
		return this.client.config;
	}
}
