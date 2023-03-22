import type { Awaitable, RESTEvents } from 'discord.js';
import { BaseEvent } from './BaseEvent.js';
import { nonEnumerable } from '#root/lib/decorators/nonEnumerable.js';
import type { LunarClient } from '#structures/LunarClient.js';

export abstract class RESTEvent extends BaseEvent {
	public abstract override readonly name: RESTEvents;

	@nonEnumerable
	public readonly client: LunarClient<boolean>;

	public constructor(client: LunarClient<true>) {
		super();
		this.client = client;
	}

	public override get emitter() {
		return this.client.rest;
	}

	public abstract override run(...args: unknown[]): Awaitable<void>;
}
