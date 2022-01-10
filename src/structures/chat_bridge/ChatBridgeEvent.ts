import { BaseEvent } from '../events/BaseEvent';
import type { EventData, BaseEventContext } from '../events/BaseEvent';
import type { ChatBridge } from './ChatBridge';

export interface ChatBridgeEventContext extends BaseEventContext {
	emitter: ChatBridge;
}
export class ChatBridgeEvent extends BaseEvent {
	chatBridge: ChatBridge;

	constructor(context: ChatBridgeEventContext, data: EventData) {
		super(context, data);

		this.chatBridge = context.emitter;
	}

	get client() {
		return this.chatBridge.client;
	}

	get config() {
		return this.client.config;
	}
}
