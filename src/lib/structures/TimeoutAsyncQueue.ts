// # The MIT License (MIT)

// Copyright © `2020` `The Sapphire Community and its contributors`

// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation
// files (the “Software”), to deal in the Software without
// restriction, including without limitation the rights to use,
// copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following
// conditions:

// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
// OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
// WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
// OTHER DEALINGS IN THE SOFTWARE.

import { setTimeout, clearTimeout } from 'node:timers';
import { logger } from '#logger';
import { minutes } from '#functions';

/**
 * The TimeoutAsyncQueue class used to sequentialize burst requests
 */
export class TimeoutAsyncQueue {
	/**
	 * time after which wait skips
	 */
	timeout = minutes(1);

	/**
	 * The remaining amount of queued promises
	 */
	get remaining() {
		return this.promises.length;
	}

	/**
	 * The promises array
	 */
	private promises: TimeoutAsyncQueueDeferredPromise[] = [];

	/**
	 * Waits for last promise and queues a new one
	 */
	wait() {
		const next = this.promises.at(-1)?.promise ?? Promise.resolve();
		let resolve: () => void;
		const promise = new Promise<void>((res) => {
			resolve = res;
		});

		this.promises.push({
			resolve: resolve!,
			promise,
			timeout: setTimeout(() => {
				logger.error(new Error(`[TimeoutAsyncQueue]: timeout after ${this.timeout} ms`));
				this.shift();
			}, this.timeout),
		});

		return next;
	}

	/**
	 * Frees the queue's lock for the next item to process
	 */
	shift() {
		const deferred = this.promises.shift();
		if (!deferred) return;

		clearTimeout(deferred.timeout);
		deferred.resolve();
	}
}

interface TimeoutAsyncQueueDeferredPromise {
	resolve: () => void;
	promise: Promise<void>;
	timeout: NodeJS.Timeout;
}
