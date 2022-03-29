import type { EventEmitter } from 'node:events';

export interface BaseEventContext {
	emitter: EventEmitter;
	name: string;
}

export interface EventData {
	once?: boolean;
	enabled?: boolean;
}

export class BaseEvent {
	emitter: EventEmitter;
	name: string;
	once: boolean;
	enabled: boolean;
	callback = this.run.bind(this);

	/**
	 * @param context
	 * @param data
	 */
	constructor({ emitter, name }: BaseEventContext, { once, enabled }: EventData = {}) {
		this.emitter = emitter;
		this.name = name;

		this.once = once ?? false;
		this.enabled = enabled ?? true;
	}

	/**
	 * add the event listener
	 * @param force whether to also load disabled events
	 */
	load(force = false) {
		if (this.enabled || force) this.emitter[this.once ? 'once' : 'on'](this.name, this.callback);
		return this;
	}

	/**
	 * remove the event listener
	 */
	unload() {
		this.emitter.off(this.name, this.callback);
		return this;
	}

	/**
	 * event listener callback
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	run(...args: unknown[]): void | Promise<void> {
		throw new Error('no run function specified');
	}
}
