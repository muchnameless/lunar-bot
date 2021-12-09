import { logger } from '../functions';
import { Event } from '../structures/events/Event';
import type { EventContext } from '../structures/events/BaseEvent';

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

		this.client.exit(-1);
	}
}
