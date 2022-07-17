import { env } from 'node:process';
import { logger } from '#logger';
import { Event } from '#structures/events/Event';
import type { ClientEvents, Events } from 'discord.js';

export default class CacheSweepEvent extends Event {
	override enabled = env.NODE_ENV === 'development';

	/**
	 * event listener callback
	 * @param message
	 */
	override run(message: ClientEvents[Events.CacheSweep][0]) {
		logger.debug(`[SWEEPERS]: ${message}`);
	}
}
