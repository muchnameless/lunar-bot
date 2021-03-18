'use strict';

const { join } = require('path');
const CommandCollection = require('../commands/CommandCollection');
const ChatBridge = require('./ChatBridge');


/**
 * @type {ChatBridge[]}
 */
class ChatBridgeArray extends Array {
	/**
	 * @param {import('../LunarClient')} client
	 */
	constructor(client, ...args) {
		super(...args);

		this.client = client;
		this.commands = new CommandCollection(this.client, join(__dirname, 'commands'));
	}

	/**
	 * built-in methods will use this as the constructor
	 * that way <ChatBridgeArray>.map returns a standard Array
	 */
	static get [Symbol.species]() {
		return Array;
	}

	/**
	 * @private
	 */
	get _accounts() {
		return process.env.MINECRAFT_ACCOUNT_TYPE.split(' ');
	}

	/**
	 * instantiates all chatBridges
	 */
	_init() {
		for (let index = 0; index < this._accounts.length; ++index) {
			this._initSingle(index);
		}
	}

	/**
	 * instantiates a single chatBridge
	 * @param {?number} index
	 */
	_initSingle(index) {
		if (this[index] instanceof ChatBridge) return; // already instantiated
		this[index] = new ChatBridge(this.client, index);
	}

	/**
	 * connects a single or all bridges, instantiating them first if not already done
	 * @param {?number} index
	 */
	async connect(index) {
		// load commands if none are present
		if (!this.commands.size) await this.commands.loadAll();

		// single
		if (typeof index === 'number' && index >= 0 && index < this._accounts.length) {
			if (!(this[index] instanceof ChatBridge)) this._initSingle(index);
			return this[index].connect();
		}

		// all
		if (this.length !== this._accounts.length) this._init();
		return Promise.all(this.map(async chatBridge => chatBridge.connect()));
	}

	/**
	 * send a message via all chatBridges both to discord and the ingame guild chat, parsing both
	 * @param {string} message
	 * @param {object} options
	 * @param {import('discord.js').MessageOptions} [options.discord]
	 * @param {import('./ChatBridge').ChatOptions} [options.ingame]
	 * @returns {Promise<[boolean, ?import('../extensions/Message')|import('../extensions/Message')[]][]>}
	 */
	async broadcast(message, options) {
		return Promise.all(this.map(async chatBridge => chatBridge.broadcast(message, options)));
	}
}

module.exports = ChatBridgeArray;
