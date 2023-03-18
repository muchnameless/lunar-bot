import { env } from 'node:process';
import type { ClientEvents, Events } from 'discord.js';
import { logger } from '#logger';
import { Event } from '#structures/events/Event.js';

export default class DebugEvent extends Event {
	public override readonly enabled = env.NODE_ENV === 'development';

	/**
	 * event listener callback
	 *
	 * @param message
	 */
	public override run(message: ClientEvents[Events.Debug][0]) {
		logger.debug(message);
	}
}
