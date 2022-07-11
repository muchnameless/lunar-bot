import { logger } from '#logger';
import { Event } from '#structures/events/Event';

export default class ShardResumeEvent extends Event {
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
