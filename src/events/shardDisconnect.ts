import { logger } from '#logger';
import { Event } from '#structures/events/Event';
import { exitProcess } from '#root/process';
import type { CloseEvent } from 'discord.js';

export default class ShardDisconnectEvent extends Event {
	/**
	 * event listener callback
	 * @param closeEvent
	 * @param id
	 */
	override run(closeEvent: CloseEvent, id: number) {
		logger.error(closeEvent, `[SHARD #${id} DISCONNECT]`);

		void exitProcess(-1);
	}
}
