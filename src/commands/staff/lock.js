'use strict';

const Command = require('../../structures/commands/Command');
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
