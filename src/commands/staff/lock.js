'use strict';

const logger = require('../../functions/logger');


module.exports = {
	// aliases: [ '' ],
	description: 'toggle the restriction of the bot to guild members',
	// usage: '',
	cooldown: 1,
	execute: async (message, args, flags) => {
		const { client } = message;
		const { config } = client;

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
	},
};
