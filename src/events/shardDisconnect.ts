import { logger } from '../logger';
import { exitProcess } from '../process';
import { Event, type EventContext } from '../structures/events/Event';
import type { CloseEvent } from 'discord.js';

export default class ShardDisconnectEvent extends Event {
	constructor(context: EventContext) {
		super(context, {
			once: false,
			enabled: true,
		});
	}

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
