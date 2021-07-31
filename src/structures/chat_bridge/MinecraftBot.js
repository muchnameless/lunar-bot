'use strict';

const { createClient } = require('minecraft-protocol');
const { join, basename } = require('path');
const { spawnEvents } = require('./constants/chatBridge');
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
	const eventFiles = await getAllJsFiles(join(__dirname, 'bot_events'));

	for (const file of eventFiles) {
		const event = require(file);
		const EVENT_NAME = basename(file, '.js');

		bot[spawnEvents.includes(EVENT_NAME) ? 'once' : 'on'](EVENT_NAME, event.bind(null, chatBridge));
	}

	logger.debug(`[CHATBRIDGE BOT EVENTS]: ${eventFiles.length} event${eventFiles.length !== 1 ? 's' : ''} loaded`);

	return bot;
};
