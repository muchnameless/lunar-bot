import { logger } from '../logger';
import { Event } from '../structures/events/Event';

export default class ErrorEvent extends Event {
	/**
	 * event listener callback
	 * @param error
	 */
	override run(error: Error) {
		logger.error(error, '[CLIENT ERROR]');
	}
}
