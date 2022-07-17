import { logger } from '#logger';
import { Event } from '#structures/events/Event';
import type { ClientEvents, Events } from 'discord.js';

export default class ShardReadyEvent extends Event {
	/**
	 * event listener callback
	 * @param shardId
	 * @param unavailableGuilds
	 */
	override run(shardId: ClientEvents[Events.ShardReady][0], unavailableGuilds?: ClientEvents[Events.ShardReady][1]) {
		if (unavailableGuilds) {
			logger.info({ unavailableGuilds }, `[SHARD #${shardId} READY]`);
		} else {
			logger.info(`[SHARD #${shardId} READY]`);
		}

		void this.client.fetchAllMembers();
	}
}
