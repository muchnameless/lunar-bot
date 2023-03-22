import { env } from 'node:process';
import { Events, type ClientEvents } from 'discord.js';
import { logger } from '#logger';
import { DiscordJSEvent } from '#structures/events/DiscordJSEvent.js';

export default class extends DiscordJSEvent {
	public override readonly name = Events.CacheSweep;

	public override readonly enabled = env.NODE_ENV === 'development';

	/**
	 * event listener callback
	 *
	 * @param message
	 */
	public override run(message: ClientEvents[Events.CacheSweep][0]) {
		logger.debug(`[CACHE SWEEP]: ${message}`);
	}
}
