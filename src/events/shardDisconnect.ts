import { logger } from '../functions';
import { Event, type EventContext } from '../structures/events/Event';

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

		void this.client.exit(-1);
	}
}
