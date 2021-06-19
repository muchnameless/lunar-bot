'use strict';

const { version } = require('discord.js');
const { stripIndents } = require('common-tags');
const ms = require('ms');
const SlashCommand = require('../../structures/commands/SlashCommand');
// const logger = require('../../functions/logger');


module.exports = class DebugCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'shows general information about the bot',
			options: [],
			defaultPermission: true,
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		const used = process.memoryUsage();

		let response = stripIndents`
			General:
			Ready at: ${this.client.readyAt.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
			Uptime: ${ms(this.client.uptime)}
			Discord.js v${version}

			Cache:
			Guilds: ${this.client.formatNumber(this.client.guilds.cache.size)}
			Channels: ${this.client.formatNumber(this.client.channels.cache.size)}
			Members: ${this.client.formatNumber(this.client.guilds.cache.reduce((acc, guild) => acc + guild.members.cache.size, 0))}
			Users: ${this.client.formatNumber(this.client.users.cache.size)}
			Messages: ${this.client.formatNumber(this.client.channels.cache.reduce((acc, channel) => acc + (channel.messages?.cache.size ?? 0), 0))}

			Memory:
		`;

		for (const [ key, value ] of Object.entries(used)) {
			response += `\n${key}: ${Math.round(value / 1024 / 1024 * 100) / 100} MB`;
		}

		return interaction.reply({
			content: response,
			code: 'js',
		});
	}
};
