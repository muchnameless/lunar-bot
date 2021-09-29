import { AsyncQueue } from '@sapphire/async-queue';
import { BLOCKED_WORDS_REGEXP } from '../constants';
import type { MessageCollector, MessageCollectorOptions } from '../MessageCollector';
import type { ChatBridge } from '../ChatBridge';
import type { HypixelMessage } from '../HypixelMessage';


interface AwaitMessagesOptions extends MessageCollectorOptions {
	errors?: string[];
}


export abstract class ChatManager {
	chatBridge: ChatBridge;
	queue: AsyncQueue;

	constructor(chatBridge: ChatBridge) {
		this.chatBridge = chatBridge;
		/**
		 * chat queue
		 */
		this.queue = new AsyncQueue();
	}

	/**
	 * regexp to check for words that are blocked on hypixel
	 */
	static BLOCKED_WORDS_REGEXP = BLOCKED_WORDS_REGEXP;

	get mcAccount() {
		return this.chatBridge.mcAccount;
	}

	get logInfo() {
		return this.chatBridge.logInfo;
	}

	get hypixelGuild() {
		return this.chatBridge.hypixelGuild;
	}

	get client() {
		return this.chatBridge.client;
	}

	/**
	 * promisified MessageCollector
	 * @param options
	 */
	awaitMessages(options?: AwaitMessagesOptions): Promise<HypixelMessage[]> {
		return new Promise((resolve, reject) => {
			const collector = this.createMessageCollector(options);

			collector.once('end', (collection, reason) => {
				if (options?.errors?.includes(reason)) {
					reject(collection);
				} else {
					resolve(collection);
				}
			});
		});
	}
	// eslint-disable-next-line class-methods-use-this
	createMessageCollector(options: any): MessageCollector {
		throw new Error('Method not implemented.');
	}
}
