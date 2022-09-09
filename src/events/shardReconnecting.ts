import { type ClientEvents, type Events } from 'discord.js';
import { logger } from '#logger';
import { Event } from '#structures/events/Event.js';

export default class ShardReconnectingEvent extends Event {
	/**
	 * event listener callback
	 *
	 * @param shardId
	 */
	public override run(shardId: ClientEvents[Events.ShardReconnecting][0]) {
		logger.info({ shardId }, '[SHARD RECONNECTING]');

		this.client.players.uncacheDiscordMembers();
	}
}
