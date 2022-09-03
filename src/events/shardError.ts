import { type ClientEvents, type Events } from 'discord.js';
import { logger } from '#logger';
import { Event } from '#structures/events/Event.js';

export default class ShardErrorEvent extends Event {
	/**
	 * event listener callback
	 *
	 * @param error
	 * @param shardId
	 */
	public override run(error: ClientEvents[Events.ShardError][0], shardId: ClientEvents[Events.ShardError][1]) {
		logger.error(error, `[SHARD #${shardId} ERROR]`);
	}
}
