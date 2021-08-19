import { logger } from '../functions/index.js';
import { Event } from '../structures/events/Event.js';


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
