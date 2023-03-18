import type { ClientEvents, Events } from 'discord.js';
import { logger } from '#logger';
import { Event } from '#structures/events/Event.js';

export default class ErrorEvent extends Event {
	/**
	 * event listener callback
	 *
	 * @param error
	 */
	public override run(error: ClientEvents[Events.Error][0]) {
		logger.error(error, '[CLIENT ERROR]');
	}
}
