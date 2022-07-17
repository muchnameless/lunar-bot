import { logger } from '#logger';
import { Event } from '#structures/events/Event';
import type { ClientEvents, Events } from 'discord.js';

export default class WarnEvent extends Event {
	/**
	 * event listener callback
	 * @param message
	 */
	override run(message: ClientEvents[Events.Warn][0]) {
		logger.warn(message);
	}
}
