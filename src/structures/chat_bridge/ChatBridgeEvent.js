import { BaseEvent } from '../events/BaseEvent.js';


export class ChatBridgeEvent extends BaseEvent {
	/**
	 * chatBridge
	 * @returns {import('./ChatBridge').ChatBridge}
	 */
	get chatBridge() {
		return this.emitter;
	}

	/**
	 * client
	 * @returns {import('../LunarClient').LunarClient}
	 */
	get client() {
		return this.chatBridge.client;
	}
}
