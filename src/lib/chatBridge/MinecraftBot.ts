import { basename } from 'node:path';
import { URL } from 'node:url';
import { findFilesRecursivelyRegex } from '@sapphire/node-utilities';
import { lazy } from 'discord.js';
import { createClient, type ClientOptions } from 'minecraft-protocol';
import { type ChatBridge } from './ChatBridge.js';
import { SPAWN_EVENTS } from './constants/index.js';
import { JS_FILE_REGEXP } from '#constants';
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

	for await (const path of findFilesRecursivelyRegex(new URL('botEvents', import.meta.url), JS_FILE_REGEXP)) {
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
		bot[SPAWN_EVENTS.has(name) ? 'once' : 'on'](name, callback.bind(chatBridge));
	}

	logger.debug({ events: events.length }, '[CREATE BOT]: events loaded');

	return bot;
}
