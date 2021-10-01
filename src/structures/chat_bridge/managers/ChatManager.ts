import { AsyncQueue } from '@sapphire/async-queue';
import { BLOCKED_WORDS_REGEXP } from '../constants';
import type { MessageCollector as DiscordMessageCollector } from 'discord.js';
import type { MessageCollector, MessageCollectorOptions } from '../MessageCollector';
import type { ChatBridge } from '../ChatBridge';


interface AwaitMessagesOptions extends MessageCollectorOptions {
	errors?: string[];
}


export abstract class ChatManager {
	chatBridge: ChatBridge;
	/**
	 * chat queue
	 */
	queue: AsyncQueue = new AsyncQueue();

	constructor(chatBridge: ChatBridge) {
		this.chatBridge = chatBridge;
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
	awaitMessages(options?: AwaitMessagesOptions) {
		return new Promise((resolve, reject) => {
			const collector = this.createMessageCollector(options) as MessageCollector;

			collector.once('end', (collection, reason) => {
				if (options?.errors?.includes(reason)) {
					reject(collection);
				} else {
					resolve(collection);
				}
			});
		});
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars, class-methods-use-this
	createMessageCollector(options: any): unknown {
		throw new Error('Method not implemented.');
	}
}
