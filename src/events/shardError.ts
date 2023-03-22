import { Events, type ClientEvents } from 'discord.js';
import { logger } from '#logger';
import { DiscordJSEvent } from '#structures/events/DiscordJSEvent.js';

export default class ShardErrorEvent extends DiscordJSEvent {
	public override readonly name = Events.ShardError;

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
