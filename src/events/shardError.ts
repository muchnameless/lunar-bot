import { logger } from '../functions';
import { Event } from '../structures/events/Event';
import type { EventContext } from '../structures/events/BaseEvent';


export default class ShardErrorEvent extends Event {
	constructor(context: EventContext) {
		super(context, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param error
	 * @param shardId
	 */
	override async run(error: Error, shardId: number) {
		logger.error(`[SHARD ERROR]: #${shardId}`, error);
	}
}
