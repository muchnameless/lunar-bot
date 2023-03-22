import type { Awaitable, Events } from 'discord.js';
import { BaseEvent } from './BaseEvent.js';
import { nonEnumerable } from '#decorators';
import type { LunarClient } from '#structures/LunarClient.js';

export abstract class DiscordJSEvent extends BaseEvent {
	public abstract override readonly name: Events;

	@nonEnumerable
	public readonly client: LunarClient<true>;

	public constructor(client: LunarClient<true>) {
		super();
		this.client = client;
	}

	public override get emitter() {
		return this.client;
	}

	public get config() {
		return this.client.config;
	}

	public abstract override run(...args: unknown[]): Awaitable<void>;
}
