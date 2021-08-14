import EventEmitter from 'events';
// import { logger } from '../../functions/logger.js';

/**
 * Filter to be applied to the collector.
 * @typedef {Function} CollectorFilter
 * @param {import('./HypixelMessage').HypixelMessage} message
 * @param {import('./HypixelMessage').HypixelMessage[]} collected The items collected by this collector
 * @returns {boolean|Promise<boolean>}
 */

/**
 * Options to be applied to the collector.
 * @typedef {object} MessageCollectorOptions
 * @property {CollectorFilter} [filter]
 * @property {?number} [time] How long to run the collector for in milliseconds
 * @property {?number} [idle] How long to stop the collector after inactivity in milliseconds
 * @property {?number} [max] maximum amount of messages that pass the filter
 * @property {?number} [maxProcessed] maximum amount of messages to filter
 */


/**
 * MessageCollector
 */
export class MessageCollector extends EventEmitter {
	/**
	 * Timeout for cleanup
	 * @type {?Timeout}
	 * @private
	 */
	#timeout = null;

	/**
	 * Timeout for cleanup due to inactivity
	 * @type {?Timeout}
	 * @private
	 */
	#idletimeout = null;
	/**
	 * handles stopping the collector when the bot got disconnected
	 */
	#handleBotDisconnection = () => this.stop('disconnect');

	/**
	 * Call this to handle an event as a collectable element
	 * @param {import('./HypixelMessage').HypixelMessage} message
	 * @emits Collector#collect
	 */
	#handleCollect = async (message) => {
		++this.received;

		if (await this.filter(message, this.collected)) {
			this.collected.push(message);

			/**
			 * Emitted whenever an element is collected.
			 * @event Collector#collect
			 * @param {import('./HypixelMessage').HypixelMessage} message
			 */
			this.emit('collect', message);

			if (this.#idletimeout) {
				clearTimeout(this.#idletimeout);
				this.#idletimeout = setTimeout(() => this.stop('idle'), this.options.idle);
			}
		}

		this.checkEnd();
	};

	/**
	 * @param {import('./ChatBridge').ChatBridge} chatBridge
	 * @param {CollectorFilter} filter
	 * @param {MessageCollectorOptions} options
	 */
	constructor(chatBridge, options = {}) {
		super();

		/**
		 * The chatBridge that instantiated this Collector
		 */
		this.chatBridge = chatBridge;

		/**
		 * The filter applied to this collector
		 * @type {CollectorFilter}
		 * @returns {boolean | Promise<boolean>}
		 */
		this.filter = options?.filter ?? (() => true);

		if (typeof this.filter !== 'function') {
			throw new TypeError('INVALID_TYPE: options.filter is not a function');
		}

		/**
		 * The options of this collector
		 * @type {MessageCollectorOptions}
		 */
		this.options = options;

		/**
		 * The items collected by this collector
		 * @type {import('./HypixelMessage').HypixelMessage[]}
		 */
		this.collected = [];

		/**
		 * Whether this collector has finished collecting
		 * @type {boolean}
		 */
		this.ended = false;

		/**
		 * Total number of messages that were received from the bot during message collection
		 * @type {number}
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
	 * @type {Promise}
	 * @readonly
	 */
	get next() {
		return new Promise((resolve, reject) => {
			if (this.ended) {
				reject(this.collected);
				return;
			}

			const cleanup = () => {
				this.removeListener('collect', onCollect);
				this.removeListener('end', onEnd);
			};

			const onCollect = (item) => {
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
	 * @param {string} [reason='user'] The reason this collector is ending
	 * @emits Collector#end
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
		 * @event Collector#end
		 * @param {import('./HypixelMessage').HypixelMessage[]} collected The elements collected by the collector
		 * @param {string} reason The reason the collector ended
		 */
		this.emit('end', this.collected, reason);
	}

	/**
	 * Resets the collectors timeout and idle timer.
	 * @param {Object} [options] Options
	 * @param {number} [options.time] How long to run the collector for in milliseconds
	 * @param {number} [options.idle] How long to stop the collector after inactivity in milliseconds
	 */
	resetTimer({ time, idle } = {}) {
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
	 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of}
	 */
	async *[Symbol.asyncIterator]() {
		const queue = [];
		const onCollect = item => queue.push(item);
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
							return resolve();
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
	 * @returns {?string}
	 * @private
	 */
	endReason() {
		if (this.options.max && this.collected.length >= this.options.max) return 'limit';
		if (this.options.maxProcessed && this.received === this.options.maxProcessed) return 'processedLimit';
		return null;
	}
}
