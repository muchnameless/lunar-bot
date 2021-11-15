import { BaseEvent } from './BaseEvent';
import type { LunarClient } from '../LunarClient';

export class Event extends BaseEvent {
	/**
	 * client
	 */
	get client() {
		return this.emitter as LunarClient;
	}
}
