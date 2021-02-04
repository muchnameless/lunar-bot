'use strict';

const ms = require('ms');
const Command = require('../../structures/Command');
const logger = require('../../functions/logger');


module.exports = class MyCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'ban a discord user from using the bot',
			args: true,
			usage: '[`discord id`|`@mention`] <`time` in ms lib format> <`reason`>',
			cooldown: 1,
		});
	}

	async run(client, config, message, args, flags, rawArgs) {
		const USER_TO_BAN = message.mentions.users.first() ?? (/\D/.test(args[0]) ? null : await message.client.users.fetch(args[0]));

		if (!USER_TO_BAN) return message.reply('@mention the user to ban or provide a discord user id.');

		args.shift();

		const BAN_DURATION = args.length ? ms(args[0]) : null;
		const EXPIRES_AT = BAN_DURATION ? Date.now() + BAN_DURATION : Infinity;

		if (BAN_DURATION) args.shift();

		const REASON = args.length ? args.join(' ') : null;
		const RESULT = await client.bannedUsers.add(USER_TO_BAN, { reason: REASON, expiresAt: EXPIRES_AT });

		message.reply(RESULT);
	}
};
