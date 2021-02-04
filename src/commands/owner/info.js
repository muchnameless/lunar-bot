'use strict';

const { stripIndents } = require('common-tags');
const { version } = require('discord.js');
const ms = require('ms');


module.exports = {
	description: 'shows general information about the bot',
	aliases: [ 'i' ],
	// args: true,
	usage: '',
	cooldown: 0,
	execute: async (message, args, flags) => {
		const { client } = message;
		const { config } = client;

		const info = stripIndents`
			Guilds: ${client.guilds.cache.size.toLocaleString(config.get('NUMBER_FORMAT'))}
			Channels: ${client.channels.cache.size.toLocaleString(config.get('NUMBER_FORMAT'))}
			Members: ${client.guilds.cache.reduce((acc, guild) => acc + guild.members.cache.size, 0).toLocaleString(config.get('NUMBER_FORMAT'))}
			Users: ${client.users.cache.size.toLocaleString(config.get('NUMBER_FORMAT'))}
			Ready at: ${client.readyAt.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
			Uptime: ${ms(client.uptime)}
			Discord.js v${version}
		`;

		message.reply(info, { code: 'js' });
	},
};
