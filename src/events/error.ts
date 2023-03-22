import { Events, type ClientEvents } from 'discord.js';
import { logger } from '#logger';
import { DiscordJSEvent } from '#structures/events/DiscordJSEvent.js';

export default class ErrorEvent extends DiscordJSEvent {
	public override readonly name = Events.Error;

	/**
	 * event listener callback
	 *
	 * @param error
	 */
	public override run(error: ClientEvents[Events.Error][0]) {
		logger.error(error, '[CLIENT ERROR]');
	}
}
