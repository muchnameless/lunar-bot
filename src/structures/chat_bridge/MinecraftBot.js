'use strict';

const { createClient } = require('minecraft-protocol');
const path = require('path');
const { SPAWN_EVENTS } = require('../../constants/chatBridge');
const { getAllJsFiles } = require('../../functions/files');
const logger = require('../../functions/logger');


/**
 * returns a mc bot client
 * @param {import('./ChatBridge')} chatBridge
 * @param {import('minecraft-protocol').ClientOptions} options
 */
module.exports = async (chatBridge, options) => {
	const bot = createClient(options);

	/**
	 * load bot events
	 */
	const eventFiles = await getAllJsFiles(path.join(__dirname, 'bot_events'));

	for (const file of eventFiles) {
		const event = require(file);
		const EVENT_NAME = path.basename(file, '.js');

		bot[SPAWN_EVENTS.includes(EVENT_NAME) ? 'once' : 'on'](EVENT_NAME, event.bind(null, chatBridge));
	}

	logger.debug(`[CHATBRIDGE BOT EVENTS]: ${eventFiles.length} event${eventFiles.length !== 1 ? 's' : ''} loaded`);

	/**
	 * @type {Function}
	 * @param {string} message
	 */
	bot.chat = message => bot.write('chat', { message });

	return bot;
};
