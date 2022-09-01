import { BaseEvent } from './BaseEvent';
import type { BaseEventContext } from './BaseEvent';
import type { LunarClient } from '../LunarClient';

export interface EventContext extends BaseEventContext {
	emitter: LunarClient;
}

export class Event extends BaseEvent {
	declare client: LunarClient;

	constructor(context: EventContext) {
		super(context);

		Object.defineProperty(this, 'client', { value: context.emitter });
	}

	/**
	 * client config
	 */
	get config() {
		return this.client.config;
	}
}
