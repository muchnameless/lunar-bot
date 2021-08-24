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
	 */
	async run() {
		logger.error('[SHARD DISCONNECT]: restarting process');

		this.client.exit(-1);
	}
}
