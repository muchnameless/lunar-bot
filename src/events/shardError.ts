import { logger } from '#logger';
import { Event } from '#structures/events/Event';

export default class ShardErrorEvent extends Event {
	/**
	 * event listener callback
	 * @param error
	 * @param id
	 */
	override run(error: Error, id: number) {
		logger.error(error, `[SHARD #${id} ERROR]`);
	}
}
