'use strict';

const { stripIndents } = require('common-tags');
const { version } = require('discord.js');
const ms = require('ms');
const Command = require('../../structures/Command');
const logger = require('../../functions/logger');


module.exports = class InfoCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'i' ],
			description: 'shows general information about the bot',
			args: false,
			usage: '',
			cooldown: 0,
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
		message.reply(
			stripIndents`
				Guilds: ${client.guilds.cache.size.toLocaleString(config.get('NUMBER_FORMAT'))}
				Channels: ${client.channels.cache.size.toLocaleString(config.get('NUMBER_FORMAT'))}
				Members: ${client.guilds.cache.reduce((acc, guild) => acc + guild.members.cache.size, 0).toLocaleString(config.get('NUMBER_FORMAT'))}
				Users: ${client.users.cache.size.toLocaleString(config.get('NUMBER_FORMAT'))}
				Ready at: ${client.readyAt.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
				Uptime: ${ms(client.uptime)}
				Discord.js v${version}
			`,
			{ code: 'js' },
		);
	}
};
