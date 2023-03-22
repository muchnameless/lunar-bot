import { Events, type ClientEvents } from 'discord.js';
import { logger } from '#logger';
import { DiscordJSEvent } from '#structures/events/DiscordJSEvent.js';

export default class ShardResumeEvent extends DiscordJSEvent {
	public override readonly name = Events.ShardResume;

	/**
	 * event listener callback
	 *
	 * @param shardId
	 * @param replayedEvents
	 */
	public override run(
		shardId: ClientEvents[Events.ShardResume][0],
		replayedEvents: ClientEvents[Events.ShardResume][1],
	) {
		logger.info({ replayedEvents, shardId }, '[SHARD RESUME]');

		void this.client.fetchAllMembers();
	}
}
