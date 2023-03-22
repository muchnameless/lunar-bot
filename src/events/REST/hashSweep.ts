import { env } from 'node:process';
import type { RestEvents, RESTEvents } from 'discord.js';
import { logger } from '#logger';
import { RESTEvent } from '#structures/events/RESTEvent.js';

export default class RESTHashSweepEvent extends RESTEvent {
	public override readonly enabled = env.NODE_ENV === 'development';

	/**
	 * event listener callback
	 *
	 * @param sweptHashes
	 */
	public override run(sweptHashes: RestEvents[RESTEvents.HashSweep][0]) {
		logger.debug({ sweptHashes: Object.fromEntries(sweptHashes.entries()) }, '[REST HASH SWEEP]');
	}
}
