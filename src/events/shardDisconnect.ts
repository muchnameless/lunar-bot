import { logger } from '../logger';
import { exitProcess } from '../process';
import { Event } from '../structures/events/Event';
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
