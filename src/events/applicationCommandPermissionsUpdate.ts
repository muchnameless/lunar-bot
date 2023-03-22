import { Events, type ClientEvents } from 'discord.js';
import { DiscordJSEvent } from '#structures/events/DiscordJSEvent.js';

export default class ApplicationCommandPermissionsUpdateEvent extends DiscordJSEvent {
	public override readonly name = Events.ApplicationCommandPermissionsUpdate;

	/**
	 * event listener callback
	 *
	 * @param data
	 */
	public override run({ applicationId, ...data }: ClientEvents[Events.ApplicationCommandPermissionsUpdate][0]) {
		// ignore updates for permissions from other bots
		if (applicationId !== this.client.application.id) return;

		this.client.permissions.update(data);
	}
}
