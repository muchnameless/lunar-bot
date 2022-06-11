import type { EventEmitter } from 'node:events';

export interface BaseEventContext {
	emitter: EventEmitter;
	name: string;
}

export class BaseEvent {
	emitter: EventEmitter;
	name: string;
	once = false;
	enabled = true;
	callback = this.run.bind(this);

	/**
	 * @param context
	 */
	constructor({ emitter, name }: BaseEventContext) {
		this.emitter = emitter;
		this.name = name;
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
