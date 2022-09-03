import { type ChatBridge } from './ChatBridge.js';
import { BaseEvent, type BaseEventContext } from '#structures/events/BaseEvent.js';

export interface ChatBridgeEventContext extends BaseEventContext {
	emitter: ChatBridge;
}
export class ChatBridgeEvent extends BaseEvent {
	public readonly chatBridge: ChatBridge;

	public constructor(context: ChatBridgeEventContext) {
		super(context);

		this.chatBridge = context.emitter;
	}

	public get client() {
		return this.chatBridge.client;
	}

	public get config() {
		return this.client.config;
	}
}
