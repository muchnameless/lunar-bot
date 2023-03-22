import { Events, type ClientEvents } from 'discord.js';
import { logger } from '#logger';
import { DiscordJSEvent } from '#structures/events/DiscordJSEvent.js';

export default class extends DiscordJSEvent {
	public override readonly name = Events.ShardReconnecting;

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
