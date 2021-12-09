import { logger } from '../functions';
import { Event } from '../structures/events/Event';
import type { Snowflake } from 'discord-api-types';
import type { EventContext } from '../structures/events/BaseEvent';

export default class ShardReadyEvent extends Event {
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
	override run(id: number, unavailableGuilds?: Set<Snowflake>) {
		if (unavailableGuilds) {
			logger.info({ unavailableGuilds }, `[SHARD #${id} READY]`);
		} else {
			logger.info(`[SHARD #${id} READY]`);
		}

		this.client.fetchAllMembers();
	}
}
