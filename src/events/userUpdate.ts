import { type ClientEvents, type Events } from 'discord.js';
import { Event } from '#structures/events/Event.js';
import { UserUtil } from '#utils';

export default class UserUpdateEvent extends Event {
	/**
	 * event listener callback
	 *
	 * @param oldUser
	 * @param newUser
	 */
	public override run(oldUser: ClientEvents[Events.UserUpdate][0], newUser: ClientEvents[Events.UserUpdate][1]) {
		// changed username -> check if new name includes ign
		if (oldUser.username !== newUser.username) {
			void UserUtil.getPlayer(newUser)?.syncIgnWithDisplayName(false);
		}
	}
}
