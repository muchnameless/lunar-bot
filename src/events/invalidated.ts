import { Events } from 'discord.js';
import { logger } from '#logger';
import { exitProcess } from '#root/process.js';
import { DiscordJSEvent } from '#structures/events/DiscordJSEvent.js';

export default class extends DiscordJSEvent {
	public override readonly name = Events.Invalidated;

	/**
	 * event listener callback
	 */
	public override run() {
		logger.warn('[INVALIDATED]: the client became invalidated');
		void exitProcess(1);
	}
}
