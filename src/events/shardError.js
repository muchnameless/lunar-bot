import { Event } from '../structures/events/Event.js';
import { logger } from '../functions/logger.js';


export default class ShardErrorEvent extends Event {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param {Error} error
	 * @param {number} shardId
	 */
	async run(error, shardId) {
		logger.error(`[SHARD ERROR]: #${shardId}`, error);
	}
}
