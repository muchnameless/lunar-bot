import { logger } from '#logger';
import { Event } from '#structures/events/Event';
import { exitProcess } from '#root/process';
import type { ClientEvents, Events } from 'discord.js';

export default class ShardDisconnectEvent extends Event {
	/**
	 * event listener callback
	 * @param closeEvent
	 * @param shardId
	 */
	override run(closeEvent: ClientEvents[Events.ShardDisconnect][0], shardId: ClientEvents[Events.ShardDisconnect][1]) {
		logger.error(closeEvent, `[SHARD #${shardId} DISCONNECT]`);

		void exitProcess(-1);
	}
}
