import { logger } from '#logger';
import { Event } from '#structures/events/Event';
import type { ClientEvents, Events } from 'discord.js';

export default class ErrorEvent extends Event {
	/**
	 * event listener callback
	 * @param error
	 */
	override run(error: ClientEvents[Events.Error][0]) {
		logger.error(error, '[CLIENT ERROR]');
	}
}
