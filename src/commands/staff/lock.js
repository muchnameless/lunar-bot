'use strict';

const Command = require('../../structures/Command');
const logger = require('../../functions/logger');


module.exports = class LockCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'toggle the restriction of the bot to guild members',
			usage: '',
			cooldown: 1,
		});
	}

	async run(client, config, message, args, flags, rawArgs) {
		try {
			switch (config.getBoolean('GUILD_PLAYER_ONLY_MODE')) {
				case false:
					await config.set('GUILD_PLAYER_ONLY_MODE', 'true');
					return message.reply(`${client.user} is now restricted to guild members.`);

				case true:
					await config.set('GUILD_PLAYER_ONLY_MODE', 'false');
					return message.reply(`${client.user} is now open to all users.`);
			}
		} catch (error) {
			logger.error(error);
			message.reply('error while editing the config entry.');
		}
	}
};
