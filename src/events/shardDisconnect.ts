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
	 * @param shardId
	 */
	override run(closeEvent: CloseEvent, shardId: number) {
		logger.error(closeEvent, `[SHARD #${shardId} DISCONNECT]`);

		this.client.exit(-1);
	}
}
