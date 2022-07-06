import { basename } from 'node:path';
import { URL } from 'node:url';
import { createClient } from 'minecraft-protocol';
import { readJSFiles } from '../../functions';
import { logger } from '../../logger';
import { SPAWN_EVENTS } from './constants';
import type { ClientOptions } from 'minecraft-protocol';
import type { ChatBridge } from './ChatBridge';

interface MinecraftBotEvent {
	name: string;
	callback: (chatBridge: ChatBridge) => void;
}

/**
 * load events from files
 */
async function getEvents() {
	const events: MinecraftBotEvent[] = [];

	for await (const path of readJSFiles(new URL('./bot_events/', import.meta.url))) {
		events.push({
			name: basename(path, '.js'),
			callback: (await import(path)).default,
		});
	}

	return events;
}

let events: MinecraftBotEvent[];

/**
 * returns a mc bot client
 * @param chatBridge
 * @param options
 */
export async function createBot(chatBridge: ChatBridge, options: ClientOptions) {
	const { client: bot, login } = createClient(options);

	/**
	 * load (and cache) bot events
	 */
	for (const { name, callback } of (events ??= await getEvents())) {
		bot[SPAWN_EVENTS.has(name as any) ? 'once' : 'on'](name, callback.bind(null, chatBridge));
	}

	logger.debug(`[CREATE BOT]: ${events.length} event${events.length !== 1 ? 's' : ''} loaded`);

	try {
		await login();
	} catch (error) {
		logger.error(error, '[CREATE BOT]');
	}

	return bot;
}
