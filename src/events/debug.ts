import { env } from 'node:process';
import { logger } from '#logger';
import { Event } from '#structures/events/Event';

export default class DebugEvent extends Event {
	override enabled = env.NODE_ENV === 'development';

	/**
	 * event listener callback
	 * @param info
	 */
	override run(info: string) {
		logger.debug(info);
	}
}
