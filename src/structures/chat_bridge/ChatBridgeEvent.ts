import { BaseEvent } from '../events/BaseEvent';
import type { BaseEventContext } from '../events/BaseEvent';
import type { ChatBridge } from './ChatBridge';

export interface ChatBridgeEventContext extends BaseEventContext {
	emitter: ChatBridge;
}
export class ChatBridgeEvent extends BaseEvent {
	chatBridge: ChatBridge;

	constructor(context: ChatBridgeEventContext) {
		super(context);

		this.chatBridge = context.emitter;
	}

	get client() {
		return this.chatBridge.client;
	}

	get config() {
		return this.client.config;
	}
}
