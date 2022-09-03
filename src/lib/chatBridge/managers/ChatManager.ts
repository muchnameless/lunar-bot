import { AsyncQueue } from '@sapphire/async-queue';
import { type ChatBridge } from '../ChatBridge.js';
import { type HypixelMessage } from '../HypixelMessage.js';
import {
	HypixelMessageCollectorEvent,
	type HypixelMessageCollector,
	type HypixelMessageCollectorOptions,
} from '../HypixelMessageCollector.js';

type AwaitMessagesOptions = HypixelMessageCollectorOptions & {
	errors?: string[];
};

export abstract class ChatManager {
	public readonly chatBridge: ChatBridge;

	/**
	 * chat queue
	 */
	public readonly queue = new AsyncQueue();

	public constructor(chatBridge: ChatBridge) {
		this.chatBridge = chatBridge;
	}

	/**
	 * regexp to check for words that are blocked on hypixel
	 */
	public static BLOCKED_WORDS_REGEXP: RegExp;

	public static ALLOWED_URLS_REGEXP: RegExp;

	/**
	 * reloads a regex filter from a file
	 *
	 * @param fileName
	 * @param propertyName
	 */
	public static async reloadFilter(fileName: `${string}.js`, propertyName: keyof typeof ChatManager) {
		const { [propertyName]: newFilter } = await import(`../constants/${fileName}?update=${Date.now()}`);

		if (!newFilter) throw new Error(`${fileName} has no export named ${propertyName}`);

		ChatManager[propertyName] = newFilter;
	}

	public get mcAccount() {
		return this.chatBridge.mcAccount;
	}

	public get logInfo() {
		return this.chatBridge.logInfo;
	}

	public get hypixelGuild() {
		return this.chatBridge.hypixelGuild;
	}

	public get client() {
		return this.chatBridge.client;
	}

	/**
	 * promisified MessageCollector
	 *
	 * @param options
	 */
	public async awaitMessages(options?: AwaitMessagesOptions): Promise<HypixelMessage[]> {
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

	public createMessageCollector(options: unknown): unknown {
		throw new Error('Method not implemented.');
	}
}

await ChatManager.reloadFilter('blockedWords.js', 'BLOCKED_WORDS_REGEXP');
await ChatManager.reloadFilter('allowedURLs.js', 'ALLOWED_URLS_REGEXP');
