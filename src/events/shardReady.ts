import { Events, type ClientEvents } from 'discord.js';
import { logger } from '#logger';
import { DiscordJSEvent } from '#structures/events/DiscordJSEvent.js';

export default class extends DiscordJSEvent {
	public override readonly name = Events.ShardReady;

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
	}
}
