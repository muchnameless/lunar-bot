import { type ClientEvents, type Events } from 'discord.js';
import { Event } from '#structures/events/Event.js';

export default class ApplicationCommandPermissionsUpdateEvent extends Event {
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
