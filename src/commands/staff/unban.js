'use strict';

const ConfigCollection = require('../../structures/collections/ConfigCollection');
const LunarMessage = require('../../structures/extensions/Message');
const LunarClient = require('../../structures/LunarClient');
const Command = require('../../structures/Command');
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
	 * @param {LunarClient} client
	 * @param {ConfigCollection} config
	 * @param {LunarMessage} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(client, config, message, args, flags, rawArgs) {
		const USER_TO_BAN = message.mentions.users.first() ?? (/\D/.test(args[0]) ? null : await message.client.users.fetch(args[0]));

		if (!USER_TO_BAN) return message.reply('@mention the user to ban or provide a discord user id.');

		const RESULT = await message.client.bannedUsers.remove(USER_TO_BAN);

		message.reply(RESULT);
	}
};
