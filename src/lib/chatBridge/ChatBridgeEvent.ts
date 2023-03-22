import type { Awaitable } from 'discord.js';
import type { ChatBridge, ChatBridgeEvents } from '#chatBridge/ChatBridge.js';
import { BaseEvent } from '#structures/events/BaseEvent.js';

export abstract class ChatBridgeEvent extends BaseEvent {
	public abstract override readonly name: ChatBridgeEvents;

	public declare readonly chatBridge: ChatBridge;

	public constructor(chatBridge: ChatBridge) {
		super();
		Object.defineProperty(this, 'chatBridge', { value: chatBridge });
	}

	public get emitter() {
		return this.chatBridge;
	}

	public get client() {
		return this.chatBridge.client;
	}

	public get config() {
		return this.client.config;
	}

	public abstract override run(...args: unknown[]): Awaitable<void>;
}
