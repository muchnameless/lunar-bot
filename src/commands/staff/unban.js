'use strict';

module.exports = {
	// aliases: [ '' ],
	description: 'unban a discord user from using the bot',
	args: true,
	usage: '[`discord id`|`@mention`]',
	cooldown: 1,
	execute: async (message, args, flags) => {
		const USER_TO_BAN = message.mentions.users.first() ?? (/\D/.test(args[0]) ? null : await message.client.users.fetch(args[0]));

		if (!USER_TO_BAN) return message.reply('@mention the user to ban or provide a discord user id.');

		const RESULT = await message.client.bannedUsers.remove(USER_TO_BAN);

		message.reply(RESULT);
	},
};
