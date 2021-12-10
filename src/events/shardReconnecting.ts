import { logger } from '../functions';
import { Event } from '../structures/events/Event';
import type { EventContext } from '../structures/events/BaseEvent';

export default class ShardReconnectingEvent extends Event {
	constructor(context: EventContext) {
		super(context, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param id
	 */
	override run(id: number) {
		logger.info(`[SHARD #${id} RECONNECTING]`);

		this.client.players.uncacheDiscordMembers();
	}
}
