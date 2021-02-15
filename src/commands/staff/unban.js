'use strict';

const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class UnbanCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'unban a discord user from using the bot',
			args: true,
			usage: '[`discord id`|`@mention`]',
			cooldown: 1,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/LunarClient')} client
	 * @param {import('../../structures/database/ConfigHandler')} config
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(client, config, message, args, flags, rawArgs) {
		const userToUnban = message.mentions.users.first()
			?? (/\D/.test(args[0])
				? null
				: await client.users.fetch(args[0]).catch(logger.error));

		if (!userToUnban) return message.reply('@mention the user to ban or provide a discord user id.');

		const RESULT = await client.bannedUsers.remove(userToUnban);

		message.reply(RESULT);
	}
};
