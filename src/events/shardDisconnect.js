import { logger } from '../functions/index.js';
import { Event } from '../structures/events/Event.js';


export default class ShardDisconnectEvent extends Event {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param {CloseEvent} closeEvent
	 * @param {number} shardId
	 */
	async run(closeEvent, shardId) {
		logger.error(`[SHARD #${shardId} DISCONNECT] ${closeEvent.code}: ${closeEvent.reason} (cleanly: ${closeEvent.wasClean})`);

		this.client.exit(-1);
	}
}
