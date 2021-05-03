'use strict';

const { stripIndents } = require('common-tags');
const { join } = require('path');
const { X_EMOJI } = require('../../constants/emojiCharacters');
const CommandCollection = require('../commands/CommandCollection');
const ChatBridge = require('./ChatBridge');
const logger = require('../../functions/logger');


/**
 * @type {ChatBridge[]}
 */
module.exports = class ChatBridgeArray extends Array {
	/**
	 * @param {import('../LunarClient')} client
	 */
	constructor(client, ...args) {
		super(...args);

		/**
		 * the client that instantiated the ChatBridgeArray
		 */
		this.client = client;
		/**
		 * minecraft command collection
		 */
		this.commands = new CommandCollection(this.client, join(__dirname, 'commands'));
		/**
		 * discord channel IDs of all ChatBridge channels
		 */
		this.channelIDs = new Set();
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
	static get _accounts() {
		return process.env.MINECRAFT_ACCOUNT_TYPE.split(' ');
	}

	/**
	 * loads channelIDs from hypixelGuilds
	 */
	loadChannelIDs() {
		for (const { chatBridgeChannels } of this.client.hypixelGuilds.cache.values()) {
			for (const { channelID } of chatBridgeChannels) {
				this.channelIDs.add(channelID);
			}
		}
	}

	/**
	 * instantiates all chatBridges
	 */
	_init() {
		for (let index = 0; index < ChatBridgeArray._accounts.length; ++index) {
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
	 * @returns {Promise<import('./ChatBridge')|import('./ChatBridge')[]>}
	 */
	async connect(index) {
		// load commands if none are present
		if (!this.commands.size) await this.commands.loadAll();

		// single
		if (typeof index === 'number' && index >= 0 && index < ChatBridgeArray._accounts.length) {
			if (!(this[index] instanceof ChatBridge)) this._initSingle(index);
			return this[index].connect();
		}

		// all
		if (this.length !== ChatBridgeArray._accounts.length) this._init();
		return Promise.all(this.map(async (/** @type {import('./ChatBridge')} */ chatBridge) => chatBridge.connect()));
	}

	/**
	 * disconnects a single or all bridges
	 * @param {?number} index
	 * @returns {import('./ChatBridge')|import('./ChatBridge')[]}
	 */
	disconnect(index) {
		// single
		if (typeof index === 'number' && index >= 0 && index < ChatBridgeArray._accounts.length) {
			if (!(this[index] instanceof ChatBridge)) throw new Error(`no chatBridge with index #${index}`);
			return this[index].disconnect();
		}

		// all
		return this.map((/** @type {import('./ChatBridge')} */ chatBridge) => chatBridge.disconnect());
	}

	/**
	 * send a message via all chatBridges both to discord and the ingame guild chat, parsing both
	 * @param {string} message
	 * @param {object} options
	 * @param {import('discord.js').MessageOptions} [options.discord]
	 * @param {import('./ChatBridge').ChatOptions} [options.minecraft]
	 * @returns {Promise<[boolean, ?import('../extensions/Message')|import('../extensions/Message')[]][]>}
	 */
	async broadcast(message, options) {
		return Promise.all(this.map(async (/** @type {import('./ChatBridge')} */ chatBridge) => chatBridge.broadcast(message, options)));
	}

	/**
	 * forwards announcement messages to all chatBridges (via broadcast)
	 * @param {import('../extensions/Message')} message
	 */
	async handleAnnouncementMessage(message) {
		if (!this.length) return message.reactSafely(X_EMOJI);

		try {
			const result = await this.broadcast(
				stripIndents`
					${message.content}
					~ ${ChatBridge.getPlayerName(message)}
				`,
				{
					discord: {
						split: { char: '\n' },
						allowedMentions: { parse: [] },
					},
					minecraft: {
						prefix: 'Guild_Announcement:',
						maxParts: Infinity,
					},
				},
			);

			if (result.every(([ minecraft, discord ]) => minecraft && (Array.isArray(discord) ? discord.length : discord))) {
				if (message.reactions.cache.get(X_EMOJI)?.me) {
					message.reactions.cache.get(X_EMOJI).users.remove(this.client.user.id)
						.catch(error => `[HANDLE ANNOUNCEMENT MSG]: ${error}`);
				}
			} else {
				message.reactSafely(X_EMOJI);
			}
		} catch (error) {
			logger.error(`[HANDLE ANNOUNCEMENT MSG]: ${error}`);
			message.reactSafely(X_EMOJI);
		}
	}

	/**
	 * forwards the discord message if a chat bridge for that channel is found
	 * @param {import('../extensions/Message')} message
	 * @param {import('./ChatBridge').MessageForwardOptions} [options]
	 */
	async handleDiscordMessage(message, options) {
		if (!this.channelIDs.has(message.channel.id)) return;

		if (!this.length && this.client.config.getBoolean('CHATBRIDGE_ENABLED')) return message.reactSafely(X_EMOJI);

		try {
			await Promise.all(this.map(async (/** @type {ChatBridge} */ chatBridge) => chatBridge.forwardDiscordToMinecraft(message, options)));
		} catch (error) {
			logger.error(`[CHAT BRIDGES]: ${error}`);
			message.reactSafely(X_EMOJI);
		}
	}
};
