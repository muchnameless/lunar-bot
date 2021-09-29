import { UserUtil } from '../util';
import { Event } from '../structures/events/Event';
import type { User } from 'discord.js';
import type { EventContext } from '../structures/events/BaseEvent';


export default class UserUpdateEvent extends Event {
	constructor(context: EventContext) {
		super(context, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param oldUser
 	 * @param newUser
	 */
	override async run(oldUser: User, newUser: User) {
		// changed username -> check if new name includes ign
		if (oldUser.username !== newUser.username) {
			UserUtil.getPlayer(newUser)?.syncIgnWithDisplayName(false);
		}
	}
}
