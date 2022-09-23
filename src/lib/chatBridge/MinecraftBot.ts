import { basename } from 'node:path';
import { URL } from 'node:url';
import { lazy } from '@sapphire/utilities';
import { createClient, type ClientOptions } from 'minecraft-protocol';
import { type ChatBridge } from './ChatBridge.js';
import { SPAWN_EVENTS } from './constants/index.js';
import { readJSFiles } from '#functions';
import { logger } from '#logger';

type MinecraftBotEvent = {
	callback(chatBridge: ChatBridge): void;
	name: string;
};

/**
 * load events from files
 */
const getEvents = lazy(async () => {
	const events: MinecraftBotEvent[] = [];

	for await (const path of readJSFiles(new URL('botEvents/', import.meta.url))) {
		events.push({
			name: basename(path, '.js'),
			callback: (await import(path)).default,
		});
	}

	return events;
});

/**
 * returns a mc bot client
 *
 * @param chatBridge
 * @param options
 */
export async function createBot(chatBridge: ChatBridge, options: ClientOptions) {
	const bot = createClient(options);

	/**
	 * load bot events
	 */
	const events = await getEvents();
	for (const { name, callback } of events) {
		bot[SPAWN_EVENTS.has(name as any) ? 'once' : 'on'](name, callback.bind(chatBridge));
	}

	logger.debug({ events: events.length }, '[CREATE BOT]: events loaded');

	return bot;
}
