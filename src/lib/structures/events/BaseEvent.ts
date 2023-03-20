import type { EventEmitter } from 'node:events';
import type { Awaitable } from 'discord.js';
import { bound } from '#decorators';

export interface BaseEventContext {
	emitter: EventEmitter;
	name: string;
}

export class BaseEvent {
	public emitter: EventEmitter;

	public readonly name: string;

	public readonly once: boolean = false;

	public readonly enabled: boolean = true;

	/**
	 * @param context
	 */
	public constructor({ emitter, name }: BaseEventContext) {
		this.emitter = emitter;
		this.name = name;
	}

	/**
	 * add the event listener
	 *
	 * @param force - whether to also load disabled events
	 */
	public load(force = false) {
		// eslint-disable-next-line @typescript-eslint/unbound-method
		if (this.enabled || force) this.emitter[this.once ? 'once' : 'on'](this.name, this.run);
		return this;
	}

	/**
	 * remove the event listener
	 */
	public unload() {
		// eslint-disable-next-line @typescript-eslint/unbound-method
		this.emitter.off(this.name, this.run);
		return this;
	}

	/**
	 * event listener callback
	 */
	@bound
	public run(...args: unknown[]): Awaitable<void> {
		throw new Error('no run function specified');
	}
}
