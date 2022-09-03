import { logger } from '#logger';
import { exitProcess } from '#root/process.js';
import { Event } from '#structures/events/Event.js';

export default class InvalidatedEvent extends Event {
	/**
	 * event listener callback
	 */
	public override run() {
		logger.warn('[INVALIDATED]: the client became invalidated');
		void exitProcess(1);
	}
}
