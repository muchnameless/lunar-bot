import { BaseEvent } from './BaseEvent.js';


export class Event extends BaseEvent {
	/**
	 * client
	 * @returns {import('../LunarClient').LunarClient}
	 */
	get client() {
		return this.emitter;
	}
}
