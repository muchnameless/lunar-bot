import { logger } from '../functions';
import { Event } from '../structures/events/Event';
import type { EventContext } from '../structures/events/BaseEvent';

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
