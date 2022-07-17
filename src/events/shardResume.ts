import { logger } from '#logger';
import { Event } from '#structures/events/Event';
import type { ClientEvents, Events } from 'discord.js';

export default class ShardResumeEvent extends Event {
	/**
	 * event listener callback
	 * @param shardId
	 * @param replayedEvents
	 */
	override run(shardId: ClientEvents[Events.ShardResume][0], replayedEvents: ClientEvents[Events.ShardResume][1]) {
		logger.info(`[SHARD #${shardId} RESUME]: ${replayedEvents} replayed Events`);

		void this.client.fetchAllMembers();
	}
}
