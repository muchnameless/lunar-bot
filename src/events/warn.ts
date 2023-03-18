import type { ClientEvents, Events } from 'discord.js';
import { logger } from '#logger';
import { Event } from '#structures/events/Event.js';

export default class WarnEvent extends Event {
	/**
	 * event listener callback
	 *
	 * @param message
	 */
	public override run(message: ClientEvents[Events.Warn][0]) {
		logger.warn(message);
	}
}
