'use strict';

const { getRolesToPurge } = require('../../functions/database');
const ConfigCollection = require('../../structures/collections/ConfigCollection');
const LunarMessage = require('../../structures/extensions/Message');
const LunarClient = require('../../structures/LunarClient');
const Command = require('../../structures/Command');
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
	 * @param {LunarClient} client
	 * @param {ConfigCollection} config
	 * @param {LunarMessage} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(client, config, message, args, flags, rawArgs) {
		const lgGuild = message.client.lgGuild;

		if (!lgGuild) return;
		if (lgGuild.members.cache.size !== lgGuild.memberCount) await lgGuild.members.fetch();

		let index = -1;

		lgGuild.members.cache.forEach(member => {
			if (member.roles.cache.has(config.get('GUILD_ROLE_ID'))) return;

			const rolesToRemove = getRolesToPurge(member);

			if (!rolesToRemove.length) return;

			client.setTimeout(() => {
				member.roles.remove(rolesToRemove).then(
					() => logger.info(`removed ${rolesToRemove.length} role(s) from ${member.user.tag} | ${member.displayName}`),
					logger.error,
				);
			}, ++index * 30 * 1000);
		});
	}
};
