import { type EventEmitter } from 'node:events';
import { type Awaitable } from '@sapphire/utilities';

export interface BaseEventContext {
	emitter: EventEmitter;
	name: string;
}

export class BaseEvent {
	public emitter: EventEmitter;

	public readonly name: string;

	public readonly once: boolean = false;

	public readonly enabled: boolean = true;

	private readonly _callback = this.run.bind(this);

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
		if (this.enabled || force) this.emitter[this.once ? 'once' : 'on'](this.name, this._callback);
		return this;
	}

	/**
	 * remove the event listener
	 */
	public unload() {
		this.emitter.off(this.name, this._callback);
		return this;
	}

	/**
	 * event listener callback
	 */
	public run(...args: unknown[]): Awaitable<void> {
		throw new Error('no run function specified');
	}
}
