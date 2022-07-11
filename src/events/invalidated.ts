import { logger } from '#logger';
import { Event } from '#structures/events/Event';
import { exitProcess } from '#root/process';

export default class InvalidatedEvent extends Event {
	/**
	 * event listener callback
	 */
	override run() {
		logger.warn('[INVALIDATED]: the client became invalidated');
		void exitProcess(1);
	}
}
