'use strict';

const { stripIndents } = require('common-tags');
const { join } = require('path');
const { X_EMOJI } = require('../../constants/emojiCharacters');
const { getPlayerName } = require('./managers/DiscordChatManager');
const BridgeCommandCollection = require('../commands/BridgeCommandCollection');
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
		this.commands = new BridgeCommandCollection(this.client, join(__dirname, 'commands'));
		/**
		 * discord channel IDs of all ChatBridge channels
		 * @type {Set<import('discord.js').Snowflake>}
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
		// await this.commands.loadAll();

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
	 * @param {string | ChatBridge.BroadcastOptions} contentOrOptions
	 * @returns {Promise<[boolean, ?import('../extensions/Message')|import('../extensions/Message')[]][]>}
	 */
	async broadcast(contentOrOptions) {
		return Promise.all(this.map(async (/** @type {import('./ChatBridge')} */ chatBridge) => chatBridge.broadcast(contentOrOptions)));
	}

	/**
	 * forwards announcement messages to all chatBridges (via broadcast)
	 * @param {import('../extensions/Message')} message
	 */
	async handleAnnouncementMessage(message) {
		if (!this.length) return message.react(X_EMOJI);

		try {
			const result = await this.broadcast({
				content: stripIndents`
					${message.content}
					~ ${getPlayerName(message)}
				`,
				discord: {
					split: { char: '\n' },
					allowedMentions: { parse: [] },
				},
				minecraft: {
					prefix: 'Guild_Announcement:',
					maxParts: Infinity,
				},
			});

			if (result.every(([ minecraft, discord ]) => minecraft && (Array.isArray(discord) ? discord.length : discord))) {
				if (message.reactions.cache.get(X_EMOJI)?.me) {
					message.reactions.cache.get(X_EMOJI).users.remove(this.client.user.id)
						.catch(error => logger.error('[HANDLE ANNOUNCEMENT MSG]', error));
				}
			} else {
				message.react(X_EMOJI);
			}
		} catch (error) {
			logger.error('[HANDLE ANNOUNCEMENT MSG]', error);
			message.react(X_EMOJI);
		}
	}

	/**
	 * forwards the discord message if a chat bridge for that channel is found
	 * @param {import('../extensions/Message')} message
	 * @param {import('./ChatBridge').MessageForwardOptions} [options={}]
	 */
	async handleDiscordMessage(message, options = {}) {
		if (!this.channelIDs.has(message.channelID) || !this.client.config.getBoolean('CHATBRIDGE_ENABLED')) return;

		try {
			// a ChatBridge for the message's channel was found
			if (this.reduce((acc, /** @type {import('./ChatBridge')} */ chatBridge) => chatBridge.handleDiscordMessage(message, options) || acc, false)) return;

			// check if the message was sent from the bot, don't react with X_EMOJI in this case
			if (options.checkIfNotFromBot) {
				if (message.me) return; // message was sent by the bot
				if (message.webhookID
					&& this.reduce((acc, /** @type {import('./ChatBridge')} */ chatBridge) => acc || (message.webhookID === chatBridge.discord.channelsByIDs.get(message.channelID)?.webhook?.id), false)
				) return; // message was sent by one of the ChatBridges's webhook
			}

			// no ChatBridge for the message's channel found
			message.react(X_EMOJI);
		} catch (error) {
			logger.error('[CHAT BRIDGES]: handleDiscordMessage', error);
			message.react(X_EMOJI);
		}
	}
};
