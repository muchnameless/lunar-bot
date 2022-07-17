import { env } from 'node:process';
import { logger } from '#logger';
import { Event } from '#structures/events/Event';
import type { ClientEvents, Events } from 'discord.js';

export default class DebugEvent extends Event {
	override enabled = env.NODE_ENV === 'development';

	/**
	 * event listener callback
	 * @param message
	 */
	override run(message: ClientEvents[Events.Debug][0]) {
		logger.debug(message);
	}
}
