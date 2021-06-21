'use strict';

const Event = require('../structures/events/Event');
// const logger = require('../functions/logger');


module.exports = class UserUpdateEvent extends Event {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param {import('../structures/extensions/User')} oldUser
 	 * @param {import('../structures/extensions/User')} newUser
	 */
	async run(oldUser, newUser) {
		// changed username -> check if new name includes ign
		if (oldUser.username !== newUser.username) {
			newUser.player?.syncIgnWithDisplayName(false);
		}
	}
};
