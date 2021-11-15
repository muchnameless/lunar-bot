import { basename } from 'node:path';
import { URL, pathToFileURL } from 'node:url';
import { createClient } from 'minecraft-protocol';
import { logger, readJSFiles } from '../../functions';
import { SPAWN_EVENTS } from './constants';
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

	for await (const { fullPath } of readJSFiles(new URL('./bot_events', import.meta.url))) {
		const event = (await import(pathToFileURL(fullPath).href)).default;
		const EVENT_NAME = basename(fullPath, '.js');

		bot[SPAWN_EVENTS.has(EVENT_NAME as any) ? 'once' : 'on'](EVENT_NAME, event.bind(null, chatBridge));

		++eventCount;
	}

	logger.debug(`[CHATBRIDGE BOT EVENTS]: ${eventCount} event${eventCount !== 1 ? 's' : ''} loaded`);

	return bot;
}
