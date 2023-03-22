import { env } from 'node:process';
import type { RestEvents, RESTEvents } from 'discord.js';
import { logger } from '#logger';
import { RESTEvent } from '#structures/events/RESTEvent.js';

export default class RESTHandlerSweepEvent extends RESTEvent {
	public override readonly enabled = env.NODE_ENV === 'development';

	/**
	 * event listener callback
	 *
	 * @param sweptHandlers
	 */
	public override run(sweptHandlers: RestEvents[RESTEvents.HandlerSweep][0]) {
		logger.debug({ sweptHandlers: Object.fromEntries(sweptHandlers.entries()) }, '[REST HANDLER SWEEP]');
	}
}
