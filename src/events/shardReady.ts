import { logger } from '../logger';
import { Event } from '../structures/events/Event';
import type { Snowflake } from 'discord.js';

export default class ShardReadyEvent extends Event {
	/**
	 * event listener callback
	 * @param id
	 * @param unavailableGuilds
	 */
	override run(id: number, unavailableGuilds?: Set<Snowflake>) {
		if (unavailableGuilds) {
			logger.info({ unavailableGuilds }, `[SHARD #${id} READY]`);
		} else {
			logger.info(`[SHARD #${id} READY]`);
		}

		void this.client.fetchAllMembers();
	}
}
