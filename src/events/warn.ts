import { Events, type ClientEvents } from 'discord.js';
import { logger } from '#logger';
import { DiscordJSEvent } from '#structures/events/DiscordJSEvent.js';

export default class WarnEvent extends DiscordJSEvent {
	public override readonly name = Events.Warn;

	/**
	 * event listener callback
	 *
	 * @param message
	 */
	public override run(message: ClientEvents[Events.Warn][0]) {
		logger.warn(message);
	}
}
