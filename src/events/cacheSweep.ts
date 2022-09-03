import { env } from 'node:process';
import { type ClientEvents, type Events } from 'discord.js';
import { logger } from '#logger';
import { Event } from '#structures/events/Event.js';

export default class CacheSweepEvent extends Event {
	public override readonly enabled = env.NODE_ENV === 'development';

	/**
	 * event listener callback
	 *
	 * @param message
	 */
	public override run(message: ClientEvents[Events.CacheSweep][0]) {
		logger.debug(`[SWEEPERS]: ${message}`);
	}
}
