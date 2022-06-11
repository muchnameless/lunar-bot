import { logger } from '../logger';
import { exitProcess } from '../process';
import { Event } from '../structures/events/Event';

export default class InvalidatedEvent extends Event {
	/**
	 * event listener callback
	 */
	override run() {
		logger.warn('[INVALIDATED]: the client became invalidated');
		void exitProcess(1);
	}
}
