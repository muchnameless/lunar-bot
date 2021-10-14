import EventEmitter from 'node:events';
import type { Awaitable } from 'discord.js';
import type { HypixelMessage } from './HypixelMessage';
import type { Timeout } from '../../types/util';
import type { ChatBridge } from './ChatBridge';


/**
 * Filter to be applied to the collector.
 */
type CollectorFilter = (message: HypixelMessage, collected: HypixelMessage[]) => boolean | Promise<boolean>;

/**
 * Options to be applied to the collector.
 */
export interface MessageCollectorOptions {
	filter?: CollectorFilter;
	/** How long to run the collector for in milliseconds */
	time?: number;
	/** How long to stop the collector after inactivity in milliseconds */
	idle?: number;
	/** maximum amount of messages that pass the filter */
	max?: number;
	/** maximum amount of messages to filter */
	maxProcessed?: number;
}

export const enum MessageCollectorEvents {
	COLLECT = 'collect',
	DISCONNECT = 'disconnect',
	END = 'end',
	MESSAGE = 'message',
}


/**
 * MessageCollector
 */
export class MessageCollector extends EventEmitter {
	/**
	 * The chatBridge that instantiated this Collector
	 */
	chatBridge: ChatBridge;
	/**
	 * The options of this collector
	 */
	options: MessageCollectorOptions;
	/**
	 * The filter applied to this collector
	 */
	filter: CollectorFilter;
	/**
	 * The items collected by this collector
	 */
	collected: HypixelMessage[] = [];
	/**
	 * Whether this collector has finished collecting
	 */
	ended = false;
	/**
	 * Total number of messages that were received from the bot during message collection
	 */
	received = 0;
	/**
	 * Timeout for cleanup
	 */
	#timeout: Timeout | null = null;
	/**
	 * Timeout for cleanup due to inactivity
	 */
	#idletimeout: Timeout | null = null;

	constructor(chatBridge: ChatBridge, options: MessageCollectorOptions = {}) {
		super();

		this.chatBridge = chatBridge;
		this.options = options;

		this.filter = options.filter ?? (() => true);
		if (typeof this.filter !== 'function') {
			throw new TypeError('INVALID_TYPE: options.filter is not a function');
		}

		this.chatBridge.incrementMaxListeners();
		this.chatBridge.on(MessageCollectorEvents.MESSAGE, this.#handleCollect);
		this.chatBridge.once(MessageCollectorEvents.DISCONNECT, this.#handleBotDisconnection);

		this.once(MessageCollectorEvents.END, () => {
			this.chatBridge.removeListener(MessageCollectorEvents.MESSAGE, this.#handleCollect);
			this.chatBridge.removeListener(MessageCollectorEvents.DISCONNECT, this.#handleBotDisconnection);
			this.chatBridge.decrementMaxListeners();
		});

		if (options.time) this.#timeout = setTimeout(() => this.stop('time'), options.time);
		if (options.idle) this.#idletimeout = setTimeout(() => this.stop('idle'), options.idle);
	}

	override on(eventName: MessageCollectorEvents.COLLECT, listener: (item: HypixelMessage) => Awaitable<void>): this;
	override on(eventName: MessageCollectorEvents.END, listener: (collected: this['collected'], reason: string) => Awaitable<void>): this;
	override on(eventName: string, listener: (...args: unknown[]) => void): this;
	override on(eventName: string, listener: (...args: any[]) => void) {
		return super.on(eventName, listener);
	}

	override once(eventName: MessageCollectorEvents.COLLECT, listener: (message: HypixelMessage) => Awaitable<void>): this;
	override once(eventName: MessageCollectorEvents.END, listener: (collected: this['collected'], reason: string) => Awaitable<void>): this;
	override once(eventName: string, listener: (...args: unknown[]) => void): this;
	override once(eventName: string, listener: (...args: any[]) => void) {
		return super.once(eventName, listener);
	}

	/**
	 * Checks after un/collection to see if the collector is done.
	 */
	get endReason() {
		if (this.options.max && this.collected.length >= this.options.max) return 'limit';
		if (this.options.maxProcessed && this.received === this.options.maxProcessed) return 'processedLimit';
		return null;
	}

	/**
	 * Returns a promise that resolves with the next collected element;
	 * rejects with collected elements if the collector finishes without receiving a next element
	 */
	get next(): Promise<HypixelMessage> {
		return new Promise((resolve, reject) => {
			if (this.ended) {
				reject(this.collected);
				return;
			}

			const cleanup = () => {
				this.removeListener(MessageCollectorEvents.COLLECT, onCollect);
				this.removeListener(MessageCollectorEvents.END, onEnd);
			};

			const onCollect = (item: HypixelMessage) => {
				cleanup();
				resolve(item);
			};

			const onEnd = () => {
				cleanup();
				reject(this.collected);
			};

			this.on(MessageCollectorEvents.COLLECT, onCollect);
			this.on(MessageCollectorEvents.END, onEnd);
		});
	}

	/**
	 * handles stopping the collector when the bot got disconnected
	 */
	#handleBotDisconnection = () => this.stop('disconnect');

	/**
	 * Call this to handle an event as a collectable element
	 * @param hypixelMessage
	 */
	#handleCollect = async (hypixelMessage: HypixelMessage) => {
		++this.received;

		// eslint-disable-next-line unicorn/no-array-method-this-argument
		if (await this.filter(hypixelMessage, this.collected)) {
			this.collected.push(hypixelMessage);

			/**
			 * Emitted whenever an element is collected.
			 */
			this.emit(MessageCollectorEvents.COLLECT, hypixelMessage);

			if (this.#idletimeout) {
				clearTimeout(this.#idletimeout);
				this.#idletimeout = setTimeout(() => this.stop('idle'), this.options.idle);
			}
		}

		this.checkEnd();
	};

	/**
	 * Stops this collector and emits the `end` event.
	 * @param reason The reason this collector is ending
	 */
	stop(reason = 'user') {
		if (this.ended) return;

		if (this.#timeout) {
			clearTimeout(this.#timeout);
			this.#timeout = null;
		}
		if (this.#idletimeout) {
			clearTimeout(this.#idletimeout);
			this.#idletimeout = null;
		}

		this.ended = true;

		/**
		 * Emitted when the collector is finished collecting.
		 * @param collected The elements collected by the collector
		 * @param reason The reason the collector ended
		 */
		this.emit(MessageCollectorEvents.END, this.collected, reason);
	}

	/**
	 * Resets the collectors timeout and idle timer.
	 * @param options Options
	 * @param options.time How long to run the collector for in milliseconds
	 * @param options.idle How long to stop the collector after inactivity in milliseconds
	 */
	resetTimer({ time, idle }: { time?: number, idle?: number } = {}) {
		if (this.#timeout) {
			clearTimeout(this.#timeout);
			this.#timeout = setTimeout(() => this.stop('time'), time ?? this.options.time);
		}
		if (this.#idletimeout) {
			clearTimeout(this.#idletimeout);
			this.#idletimeout = setTimeout(() => this.stop('idle'), idle ?? this.options.idle);
		}
	}

	/**
	 * Checks whether the collector should end, and if so, ends it.
	 */
	checkEnd() {
		const reason = this.endReason;
		if (reason) this.stop(reason);
		return Boolean(reason);
	}

	/**
	 * Allows collectors to be consumed with for-await-of loops
	 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of
	 */
	async *[Symbol.asyncIterator]() {
		const queue: HypixelMessage[] = [];
		const onCollect = (item: HypixelMessage) => { queue.push(item); };
		this.on(MessageCollectorEvents.COLLECT, onCollect);

		try {
			while (queue.length || !this.ended) {
				if (queue.length) {
					yield queue.shift();
				} else {
					await new Promise((resolve) => {
						const tick = () => {
							this.removeListener(MessageCollectorEvents.COLLECT, tick);
							this.removeListener(MessageCollectorEvents.END, tick);
							return resolve(null);
						};
						this.on(MessageCollectorEvents.COLLECT, tick);
						this.on(MessageCollectorEvents.END, tick);
					});
				}
			}
		} finally {
			this.removeListener(MessageCollectorEvents.COLLECT, onCollect);
		}
	}
}
