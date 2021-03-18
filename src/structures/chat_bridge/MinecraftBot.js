'use strict';

const { createClient } = require('minecraft-protocol');
const { join, basename } = require('path');
const { spawnEvents } = require('./constants/chatBridge');
const { getAllJsFiles } = require('../../functions/files');
const logger = require('../../functions/logger');

/**
 * @typedef {import('minecraft-protocol').Client} MinecraftBot
 * @method [chat]
 * @method [quit]
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
				this.write('chat', { message });
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
		 * the bot's player object
		 * @type {import('../database/models/Player')}
		 */
		player: {
			get() {
				if (!this._player) this._player = this.client.players.cache.get(this.uuid) ?? null;
				return this._player;
			},
		},
	});

	return bot;
};
