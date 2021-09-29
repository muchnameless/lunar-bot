import EventEmitter from 'node:events';
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


/**
 * MessageCollector
 */
export class MessageCollector extends EventEmitter {
	/**
	 * Timeout for cleanup
	 */
	#timeout: Timeout | null = null;

	/**
	 * Timeout for cleanup due to inactivity
	 */
	#idletimeout: Timeout | null = null;

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

		if (await this.filter(hypixelMessage, this.collected)) {
			this.collected.push(hypixelMessage);

			/**
			 * Emitted whenever an element is collected.
			 */
			this.emit('collect', hypixelMessage);

			if (this.#idletimeout) {
				clearTimeout(this.#idletimeout);
				this.#idletimeout = setTimeout(() => this.stop('idle'), this.options.idle);
			}
		}

		this.checkEnd();
	};

	collected: HypixelMessage[];
	options: MessageCollectorOptions;
	chatBridge: ChatBridge;
	filter: CollectorFilter;
	ended: boolean;
	received: number;

	constructor(chatBridge: ChatBridge, options: MessageCollectorOptions = {}) {
		super();

		/**
		 * The chatBridge that instantiated this Collector
		 */
		this.chatBridge = chatBridge;

		/**
		 * The filter applied to this collector
		 */
		this.filter = options.filter ?? (() => true);

		if (typeof this.filter !== 'function') {
			throw new TypeError('INVALID_TYPE: options.filter is not a function');
		}

		/**
		 * The options of this collector
		 */
		this.options = options;

		/**
		 * The items collected by this collector
		 */
		this.collected = [];

		/**
		 * Whether this collector has finished collecting
		 */
		this.ended = false;

		/**
		 * Total number of messages that were received from the bot during message collection
		 */
		this.received = 0;

		this.chatBridge.incrementMaxListeners();
		this.chatBridge.on('message', this.#handleCollect);
		this.chatBridge.once('disconnect', this.#handleBotDisconnection);

		this.once('end', () => {
			this.chatBridge.removeListener('message', this.#handleCollect);
			this.chatBridge.removeListener('disconnect', this.#handleBotDisconnection);
			this.chatBridge.decrementMaxListeners();
		});

		if (options.time) this.#timeout = setTimeout(() => this.stop('time'), options.time);
		if (options.idle) this.#idletimeout = setTimeout(() => this.stop('idle'), options.idle);
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
				this.removeListener('collect', onCollect);
				this.removeListener('end', onEnd);
			};

			const onCollect = (item: HypixelMessage) => {
				cleanup();
				resolve(item);
			};

			const onEnd = () => {
				cleanup();
				reject(this.collected);
			};

			this.on('collect', onCollect);
			this.on('end', onEnd);
		});
	}

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
		this.emit('end', this.collected, reason);
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
		const reason = this.endReason();
		if (reason) this.stop(reason);
	}

	/**
	 * Allows collectors to be consumed with for-await-of loops
	 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of
	 */
	async *[Symbol.asyncIterator]() {
		const queue: HypixelMessage[] = [];
		const onCollect = (item: HypixelMessage) => queue.push(item);
		this.on('collect', onCollect);

		try {
			while (queue.length || !this.ended) {
				if (queue.length) {
					yield queue.shift();
				} else {
					await new Promise((resolve) => {
						const tick = () => {
							this.removeListener('collect', tick);
							this.removeListener('end', tick);
							return resolve(null);
						};
						this.on('collect', tick);
						this.on('end', tick);
					});
				}
			}
		} finally {
			this.removeListener('collect', onCollect);
		}
	}

	/**
	 * Checks after un/collection to see if the collector is done.
	 */
	endReason() {
		if (this.options.max && this.collected.length >= this.options.max) return 'limit';
		if (this.options.maxProcessed && this.received === this.options.maxProcessed) return 'processedLimit';
		return null;
	}
}
