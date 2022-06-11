import { UserUtil } from '../util';
import { Event } from '../structures/events/Event';
import type { User } from 'discord.js';

export default class UserUpdateEvent extends Event {
	/**
	 * event listener callback
	 * @param oldUser
	 * @param newUser
	 */
	override run(oldUser: User, newUser: User) {
		// changed username -> check if new name includes ign
		if (oldUser.username !== newUser.username) {
			void UserUtil.getPlayer(newUser)?.syncIgnWithDisplayName(false);
		}
	}
}
