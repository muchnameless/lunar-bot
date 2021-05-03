'use strict';

const { createClient } = require('minecraft-protocol');
const { join, basename } = require('path');
const { spawnEvents } = require('./constants/chatBridge');
const { getAllJsFiles } = require('../../functions/files');
const logger = require('../../functions/logger');
const Player = require('../database/models/Player');

// {import('minecraft-protocol').Client}

/**
 * @typedef {object} MinecraftBot
 * @property {import('../LunarClient')} client
 * @property {import('../database/models/Player')} player
 * @property {string} ign
 * @property {string} uuid
 * @property {boolean} ready
 * @function [chat]
 */

/**
 * returns a mc bot client
 * @param {import('./ChatBridge')} chatBridge
 * @param {import('minecraft-protocol').ClientOptions} options
 * @returns {Promise<MinecraftBot>}
 */
module.exports = async (chatBridge, options) => {
	const bot = createClient(options);

	/**
	 * load bot events
	 */
	const eventFiles = await getAllJsFiles(join(__dirname, 'bot_events'));

	for (const file of eventFiles) {
		const event = require(file);
		const EVENT_NAME = basename(file, '.js');

		bot[spawnEvents.includes(EVENT_NAME) ? 'once' : 'on'](EVENT_NAME, event.bind(null, chatBridge));
	}

	logger.debug(`[CHATBRIDGE BOT EVENTS]: ${eventFiles.length} event${eventFiles.length !== 1 ? 's' : ''} loaded`);

	Object.defineProperties(bot, {
		client: {
			value: chatBridge.client,
		},

		/**
		 * @type {Function}
		 * @param {string} message
		 */
		chat: {
			value(message) {
				if (typeof message !== 'string') throw new Error(`[BOT CHAT]: input must be a string but received ${typeof message}`);
				return this.write('chat', { message });
			},
		},

		/**
		 * @type {Function}
		 * @param {string} reason
		 */
		quit: {
			value(reason = 'disconnect.quitting') {
				this.end(reason);
			},
		},

		/**
		 * the bot's cached player object
		 */
		_player: {
			value: null,
			writable: true,
		},

		/**
		 * the bot's player object
		 */
		player: {
			get() {
				return this._player ??= this.client.players.cache.get(this.uuid) ?? null;
			},
			set(value) {
				if (!(value instanceof Player)) throw new TypeError(`[BOT]: player must be a Player but received '${value}'`);

				this._player = value;
			},
		},

		ign: {
			get() {
				return this.username;
			},
		},

		/**
		 * wether the bot is logged in and ready to receive and send chat messages
		 */
		ready: {
			value: false,
			writable: true,
		},
	});

	return bot;
};
