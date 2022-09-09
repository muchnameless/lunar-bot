import { type ClientEvents, type Events } from 'discord.js';
import { logger } from '#logger';
import { Event } from '#structures/events/Event.js';

export default class ShardReadyEvent extends Event {
	/**
	 * event listener callback
	 *
	 * @param shardId
	 * @param unavailableGuilds
	 */
	public override run(
		shardId: ClientEvents[Events.ShardReady][0],
		unavailableGuilds?: ClientEvents[Events.ShardReady][1],
	) {
		logger.info({ unavailableGuilds, shardId }, '[SHARD READY]');

		void this.client.fetchAllMembers();
	}
}
