import { type BaseEventContext, BaseEvent } from './BaseEvent.js';
import type { LunarClient } from '#structures/LunarClient.js';

export interface EventContext extends BaseEventContext {
	emitter: LunarClient;
}

export class Event extends BaseEvent {
	public declare readonly client: LunarClient<true>;

	public constructor(context: EventContext) {
		super(context);

		Object.defineProperty(this, 'client', { value: context.emitter });
	}

	/**
	 * client config
	 */
	public get config() {
		return this.client.config;
	}
}
