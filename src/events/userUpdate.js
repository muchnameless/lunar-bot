'use strict';

// const logger = require('../functions/logger');


/**
 * guildMemberUpdate
 * @param {import('../structures/LunarClient')} client
 * @param {import('../structures/extensions/User')} oldUser
 * @param {import('../structures/extensions/User')} newUser
 */
module.exports = async (client, oldUser, newUser) => {
	// changed username -> check if new name includes ign
	if (oldUser.username !== newUser.username) {
		newUser.player?.syncIgnWithDisplayName(false);
	}
};
