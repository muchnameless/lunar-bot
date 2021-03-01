'use strict';

const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class RankCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'request' ],
			description: 'request a guild rank',
			args: true,
			usage: '[rank `name`]',
			cooldown: 1,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/LunarClient')} client
	 * @param {import('../../structures/database/managers/ConfigManager')} config
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(client, config, message, args, flags, rawArgs) {
		(message.author.player?.guild ?? client.hypixelGuilds.cache.first()).handleRankRequestMessage(message);
	}
};
