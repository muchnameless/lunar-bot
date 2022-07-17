import { UserUtil } from '#utils';
import { Event } from '#structures/events/Event';
import type { ClientEvents, Events } from 'discord.js';

export default class UserUpdateEvent extends Event {
	/**
	 * event listener callback
	 * @param oldUser
	 * @param newUser
	 */
	override run(oldUser: ClientEvents[Events.UserUpdate][0], newUser: ClientEvents[Events.UserUpdate][1]) {
		// changed username -> check if new name includes ign
		if (oldUser.username !== newUser.username) {
			void UserUtil.getPlayer(newUser)?.syncIgnWithDisplayName(false);
		}
	}
}
