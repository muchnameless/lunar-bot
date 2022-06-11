import { logger } from '../logger';
import { Event } from '../structures/events/Event';

export default class WarnEvent extends Event {
	/**
	 * event listener callback
	 * @param warning
	 */
	override run(warning: string) {
		logger.warn(warning);
	}
}
