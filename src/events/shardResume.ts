import { logger } from '../functions';
import { Event } from '../structures/events/Event';
import type { EventContext } from '../structures/events/BaseEvent';

export default class ShardResumeEvent extends Event {
	constructor(context: EventContext) {
		super(context, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param id
	 * @param replayedEvents
	 */
	override run(id: number, replayedEvents: number) {
		logger.info(`[SHARD #${id} RESUMED]: ${replayedEvents} replayed Events`);

		this.client.fetchAllMembers();
	}
}
