import type { Events } from 'discord.js';
import { DiscordJSEvent } from '#structures/events/DiscordJSEvent.js';

export default class extends DiscordJSEvent {
	public override readonly name = '' as Events;

	/**
	 * event listener callback
	 */
	public override async run() {
		// do stuff
	}
}
