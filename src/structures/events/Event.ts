import type { LunarClient } from '../LunarClient';
import { BaseEvent } from './BaseEvent';


export class Event extends BaseEvent {
	/**
	 * client
	 */
	override get client() {
		return this.emitter as LunarClient;
	}
}
