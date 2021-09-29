import { BaseEvent } from '../events/BaseEvent';
import type { ChatBridge } from './ChatBridge';


export class ChatBridgeEvent extends BaseEvent {
	/**
	 * chatBridge
	 */
	get chatBridge() {
		return this.emitter as ChatBridge;
	}

	/**
	 * client
	 */
	override get client() {
		return this.chatBridge.client;
	}
}
