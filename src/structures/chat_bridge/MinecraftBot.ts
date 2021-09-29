import { basename } from 'node:path';
import { URL, fileURLToPath, pathToFileURL } from 'node:url';
import { createClient } from 'minecraft-protocol';
import readdirp from 'readdirp';
import { SPAWN_EVENTS } from './constants';
import { logger } from '../../functions';
import type { ClientOptions } from 'minecraft-protocol';
import type { ChatBridge } from './ChatBridge';


/**
 * returns a mc bot client
 * @param chatBridge
 * @param options
 */
export async function createBot(chatBridge: ChatBridge, options: ClientOptions) {
	const bot = createClient(options);

	/**
	 * load bot events
	 */
	let eventCount = 0;

	for await (const { fullPath } of readdirp(fileURLToPath(new URL('./bot_events', import.meta.url)), {
		fileFilter: [ '*.js', '!~*' ],
	})) {
		const event = (await import(pathToFileURL(fullPath).href)).default;
		const EVENT_NAME = basename(fullPath, '.js');

		bot[SPAWN_EVENTS.includes(EVENT_NAME as any) ? 'once' : 'on'](EVENT_NAME, event.bind(null, chatBridge));

		++eventCount;
	}

	logger.debug(`[CHATBRIDGE BOT EVENTS]: ${eventCount} event${eventCount !== 1 ? 's' : ''} loaded`);

	return bot;
}
