import { createClient } from 'minecraft-protocol';
import { basename } from 'path';
import { pathToFileURL } from 'url';
import { SPAWN_EVENTS } from './constants/index.js';
import { getAllJsFiles, logger } from '../../functions/index.js';


/**
 * returns a mc bot client
 * @param {import('./ChatBridge').ChatBridge} chatBridge
 * @param {import('minecraft-protocol').ClientOptions} options
 */
export async function createBot(chatBridge, options) {
	const bot = createClient(options);

	/**
	 * load bot events
	 */
	const eventFiles = await getAllJsFiles(new URL('./bot_events', import.meta.url));

	for (const file of eventFiles) {
		const event = (await import(pathToFileURL(file).href)).default;
		const EVENT_NAME = basename(file, '.js');

		bot[SPAWN_EVENTS.includes(EVENT_NAME) ? 'once' : 'on'](EVENT_NAME, event.bind(null, chatBridge));
	}

	logger.debug(`[CHATBRIDGE BOT EVENTS]: ${eventFiles.length} event${eventFiles.length !== 1 ? 's' : ''} loaded`);

	return bot;
}
