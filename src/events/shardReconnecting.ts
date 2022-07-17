import { logger } from '#logger';
import { Event } from '#structures/events/Event';
import type { ClientEvents, Events } from 'discord.js';

export default class ShardReconnectingEvent extends Event {
	/**
	 * event listener callback
	 * @param shardId
	 */
	override run(shardId: ClientEvents[Events.ShardReconnecting][0]) {
		logger.info(`[SHARD #${shardId} RECONNECTING]`);

		this.client.players.uncacheDiscordMembers();
	}
}
