import { UserUtil } from '../util/UserUtil.js';
import { Event } from '../structures/events/Event.js';
// import { logger } from '../functions/logger.js';


export default class UserUpdateEvent extends Event {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param {import('discord.js').User} oldUser
 	 * @param {import('discord.js').User} newUser
	 */
	async run(oldUser, newUser) {
		// changed username -> check if new name includes ign
		if (oldUser.username !== newUser.username) {
			UserUtil.getPlayer(newUser)?.syncIgnWithDisplayName(false);
		}
	}
}
