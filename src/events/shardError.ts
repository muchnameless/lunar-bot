import { logger } from '../logger';
import { Event, type EventContext } from '../structures/events/Event';

export default class ShardErrorEvent extends Event {
	constructor(context: EventContext) {
		super(context, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param error
	 * @param id
	 */
	override run(error: Error, id: number) {
		logger.error(error, `[SHARD #${id} ERROR]`);
	}
}
