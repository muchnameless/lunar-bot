import { logger } from '#logger';
import { Event } from '#structures/events/Event';

export default class ShardReconnectingEvent extends Event {
	/**
	 * event listener callback
	 * @param id
	 */
	override run(id: number) {
		logger.info(`[SHARD #${id} RECONNECTING]`);

		this.client.players.uncacheDiscordMembers();
	}
}
