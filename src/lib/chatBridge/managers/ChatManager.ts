import { AsyncQueue } from '@sapphire/async-queue';
import { HypixelMessageCollectorEvent } from '../HypixelMessageCollector';
import type { HypixelMessageCollector, HypixelMessageCollectorOptions } from '../HypixelMessageCollector';
import type { ChatBridge } from '../ChatBridge';
import type { HypixelMessage } from '../HypixelMessage';

interface AwaitMessagesOptions extends HypixelMessageCollectorOptions {
	errors?: string[];
}

export abstract class ChatManager {
	chatBridge: ChatBridge;
	/**
	 * chat queue
	 */
	queue = new AsyncQueue();

	constructor(chatBridge: ChatBridge) {
		this.chatBridge = chatBridge;
	}

	/**
	 * regexp to check for words that are blocked on hypixel
	 */
	static BLOCKED_WORDS_REGEXP: RegExp;
	static ALLOWED_URLS_REGEXP: RegExp;

	/**
	 * reloads a regex filter from a file
	 * @param fileName
	 * @param propertyName
	 */
	static async reloadFilter(fileName: `${string}.js`, propertyName: keyof typeof ChatManager) {
		const { [propertyName]: newFilter } = await import(`../constants/${fileName}?update=${Date.now()}`);

		if (!newFilter) throw new Error(`${fileName} has no export named ${propertyName}`);

		ChatManager[propertyName] = newFilter;
	}

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
			const collector = this.createMessageCollector(options) as HypixelMessageCollector;

			collector.once(HypixelMessageCollectorEvent.End, (collection, reason) => {
				if (options?.errors?.includes(reason)) {
					reject(collection);
				} else {
					resolve(collection);
				}
			});
		});
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars, class-methods-use-this
	createMessageCollector(options: unknown): unknown {
		throw new Error('Method not implemented.');
	}
}

await ChatManager.reloadFilter('blockedWords.js', 'BLOCKED_WORDS_REGEXP');
await ChatManager.reloadFilter('allowedURLs.js', 'ALLOWED_URLS_REGEXP');
