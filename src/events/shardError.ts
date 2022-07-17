import { logger } from '#logger';
import { Event } from '#structures/events/Event';
import type { ClientEvents, Events } from 'discord.js';

export default class ShardErrorEvent extends Event {
	/**
	 * event listener callback
	 * @param error
	 * @param shardId
	 */
	override run(error: ClientEvents[Events.ShardError][0], shardId: ClientEvents[Events.ShardError][1]) {
		logger.error(error, `[SHARD #${shardId} ERROR]`);
	}
}
