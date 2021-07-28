'use strict';

const { AsyncQueue } = require('@sapphire/async-queue');
const { blockedWordsRegExp, randomInvisibleCharacter } = require('../constants/chatBridge');

/**
 * @typedef {import('../MessageCollector').MessageCollectorOptions & { errors: ?string[] }} AwaitMessagesOptions
 */


module.exports = class ChatManager {
	/**
	 * @param {import('../ChatBridge')} chatBridge
	 */
	constructor(chatBridge) {
		this.chatBridge = chatBridge;
		/**
		 * chat queue
		 */
		this.queue = new AsyncQueue();
	}

	/**
	 * regexp to check for words that are blocked on hypixel
	 */
	static BLOCKED_WORDS_REGEXP = blockedWordsRegExp;

	/**
	 * escapes all standalone occurrences of 'ez', case-insensitive
	 * @param {string} string
	 */
	static escapeEz(string) {
		return string.replace(/(?<=\be+)(?=z+\b)/gi, randomInvisibleCharacter());
	}

	get mcAccount() {
		return this.chatBridge.mcAccount;
	}

	get logInfo() {
		return this.chatBridge.logInfo;
	}

	get guild() {
		return this.chatBridge.guild;
	}

	get client() {
		return this.chatBridge.client;
	}

	/**
	 * promisified MessageCollector
	 * @param {AwaitMessagesOptions} options
	 * @returns {Promise<import('../HypixelMessage')[]>}
	 */
	awaitMessages(options = {}) {
		return new Promise((resolve, reject) => {
			const collector = this.createMessageCollector(options);

			collector.once('end', (collection, reason) => {
				if (options.errors?.includes(reason)) {
					reject(collection);
				} else {
					resolve(collection);
				}
			});
		});
	}
};
