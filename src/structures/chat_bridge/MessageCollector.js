'use strict';

const Collector = require('../Collector');

/**
 * @typedef {import('../Collector').CollectorOptions} MessageCollectorOptions
 * @property {number} max The maximum amount of messages to collect
 * @property {number} maxProcessed The maximum amount of messages to process
 */

/**
 * Collects messages on a channel.
 * Will automatically stop if the channel (`'channelDelete'`) or guild (`'guildDelete'`) are deleted.
 * @extends {Collector}
 */
class MessageCollector extends Collector {
	/**
	 * @param {import('./ChatBridge')} chatBridge
	 * @param {import('../Collector').CollectorFilter} filter The filter to be applied to this collector
	 * @param {MessageCollectorOptions} options The options to be applied to this collector
	 * @emits MessageCollector#message
	 */
	constructor(chatBridge, filter, options = {}) {
		super(chatBridge.client, filter, options);

		/**
		 * The channel
		 * @type {TextBasedChannel}
		 */
		this.chatBridge = chatBridge;

		/**
		 * Total number of messages that were received in the channel during message collection
		 * @type {number}
		 */
		this.received = 0;

		/**
		 * @type {import('../LunarClient')}
		 */
		this.client;

		this.chatBridge.bot.on('message', this.handleCollect);
		this.chatBridge.bot.on('end', this._handleBotDisconnection);

		this.once('end', () => {
			this.chatBridge.bot.removeListener('message', this.handleCollect);
		});
	}

	/**
	 * Handles a message for possible collection.
	 * @param {import('./events/message').TextComponent[]} message The message that could be collected
	 * @returns {string}
	 * @private
	 */
	collect(message) {
		/**
		 * Emitted whenever a message is collected.
		 * @event MessageCollector#collect
		 * @param {import('./events/message').TextComponent[]} message The message that was collected
		 */
		this.received++;
		return message.toString().trim();
	}

	/**
	 * Checks after un/collection to see if the collector is done.
	 * @returns {?string}
	 * @private
	 */
	endReason() {
		if (this.options.max && this.collected.size >= this.options.max) return 'limit';
		if (this.options.maxProcessed && this.received === this.options.maxProcessed) return 'processedLimit';
		return null;
	}

	/**
	 * handles stopping the collector when the bot got disconnected
	 */
	_handleBotDisconnection() {
		this.stop('botDisconnected');
	}
}

module.exports = MessageCollector;
