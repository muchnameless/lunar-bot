'use strict';

const { getRolesToPurge } = require('../../functions/database');
const logger = require('../../functions/logger');


module.exports = {
	// aliases: [ '' ],
	description: 'removes all roles that the bot manages from non guild members',
	args: false,
	// usage: '<test arguments>',
	cooldown: 0,
	execute: async (message, args, flags) => {
		const { config } = message.client;
		const lgGuild = message.client.lgGuild;

		if (!lgGuild) return;
		if (lgGuild.members.cache.size !== lgGuild.memberCount) await lgGuild.members.fetch();

		let index = -1;

		lgGuild.members.cache.forEach(member => {
			if (member.roles.cache.has(config.get('GUILD_ROLE_ID'))) return;

			const rolesToRemove = getRolesToPurge(member);

			if (!rolesToRemove.length) return;

			message.client.setTimeout(() => {
				member.roles.remove(rolesToRemove).then(
					() => logger.info(`removed ${rolesToRemove.length} role(s) from ${member.user.tag} | ${member.displayName}`),
					logger.error,
				);
			}, ++index * 30 * 1000);
		});
	},
};
