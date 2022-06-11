import { env } from 'node:process';
import { logger } from '../logger';
import { Event } from '../structures/events/Event';

export default class CacheSweepEvent extends Event {
	override enabled = env.NODE_ENV === 'development';

	/**
	 * event listener callback
	 * @param message
	 */
	override run(message: string) {
		logger.debug(`[SWEEPERS]: ${message}`);
	}
}
