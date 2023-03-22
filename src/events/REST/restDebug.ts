import { env } from 'node:process';
import { RESTEvents, type RestEvents } from 'discord.js';
import { logger } from '#logger';
import { RESTEvent } from '#structures/events/RESTEvent.js';

export default class extends RESTEvent {
	public override readonly name = RESTEvents.Debug;

	public override readonly enabled = env.NODE_ENV === 'development';

	/**
	 * event listener callback
	 *
	 * @param info
	 */
	public override run(info: RestEvents[RESTEvents.Debug][0]) {
		logger.debug({ info }, '[REST DEBUG]');
	}
}
