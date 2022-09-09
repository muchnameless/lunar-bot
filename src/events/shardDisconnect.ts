import { type ClientEvents, type Events } from 'discord.js';
import { logger } from '#logger';
import { exitProcess } from '#root/process.js';
import { Event } from '#structures/events/Event.js';

export default class ShardDisconnectEvent extends Event {
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
