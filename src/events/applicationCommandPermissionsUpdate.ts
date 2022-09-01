import { Event } from '#structures/events/Event';
import type { ClientEvents, Events } from 'discord.js';

export default class ApplicationCommandPermissionsUpdateEvent extends Event {
	/**
	 * event listener callback
	 * @param data
	 */
	override run({ applicationId, ...data }: ClientEvents[Events.ApplicationCommandPermissionsUpdate][0]) {
		// ignore updates for permissions from other bots
		if (applicationId !== this.client.application!.id) return;

		this.client.permissions.update(data);
	}
}
