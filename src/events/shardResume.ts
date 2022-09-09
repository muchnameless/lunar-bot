import { type ClientEvents, type Events } from 'discord.js';
import { logger } from '#logger';
import { Event } from '#structures/events/Event.js';

export default class ShardResumeEvent extends Event {
	/**
	 * event listener callback
	 *
	 * @param shardId
	 * @param replayedEvents
	 */
	public override run(
		shardId: ClientEvents[Events.ShardResume][0],
		replayedEvents: ClientEvents[Events.ShardResume][1],
	) {
		logger.info({ replayedEvents, shardId }, '[SHARD RESUME]');

		void this.client.fetchAllMembers();
	}
}
