import { Events, type ClientEvents } from 'discord.js';
import { logger } from '#logger';
import { exitProcess } from '#root/process.js';
import { DiscordJSEvent } from '#structures/events/DiscordJSEvent.js';

export default class extends DiscordJSEvent {
	public override readonly name = Events.ShardDisconnect;

	/**
	 * event listener callback
	 *
	 * @param closeEvent
	 * @param shardId
	 */
	public override run(
		closeEvent: ClientEvents[Events.ShardDisconnect][0],
		shardId: ClientEvents[Events.ShardDisconnect][1],
	) {
		logger.error({ closeEvent, shardId }, '[SHARD DISCONNECT]');

		void exitProcess(-1);
	}
}
