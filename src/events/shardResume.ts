import { logger } from '../logger';
import { Event, type EventContext } from '../structures/events/Event';

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
		logger.info(`[SHARD #${id} RESUME]: ${replayedEvents} replayed Events`);

		void this.client.fetchAllMembers();
	}
}
