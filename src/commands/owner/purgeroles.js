'use strict';

const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class PurgeRolesCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'removes all roles that the bot manages from non guild members',
			args: false,
			usage: '',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run() {
		const { lgGuild } = this.client;

		if (!lgGuild) return;
		if (lgGuild.members.cache.size !== lgGuild.memberCount) await lgGuild.members.fetch();

		let index = -1;

		lgGuild.members.cache.forEach((member) => {
			if (member.roles.cache.has(this.client.config.get('GUILD_ROLE_ID'))) return;

			/**
			 * @type {string[]}
			 */
			const rolesToRemove = member.rolesToPurge;

			if (!rolesToRemove.length) return;

			this.client.setTimeout(() => {
				member.roles.remove(rolesToRemove).then(
					() => logger.info(`removed ${rolesToRemove.length} role(s) from ${member.user.tag} | ${member.displayName}`),
					logger.error,
				);
			}, ++index * 30 * 1_000);
		});
	}
};
