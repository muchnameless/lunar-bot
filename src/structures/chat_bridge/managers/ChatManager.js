'use strict';

const { AsyncQueue } = require('@sapphire/async-queue');
const { blockedWordsRegExp } = require('../constants/chatBridge');

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
