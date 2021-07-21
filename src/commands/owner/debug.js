'use strict';

const { Formatters, version } = require('discord.js');
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

		let memoryInfo = '';

		for (const [ key, value ] of Object.entries(used)) {
			memoryInfo += `\n${key}: ${Math.round(value / 1024 / 1024 * 100) / 100} MB`;
		}

		const embed = this.client.defaultEmbed
			.addFields({
				name: 'General',
				value: stripIndents`
					Ready at: ${Formatters.time(this.client.readyAt, Formatters.TimestampStyles.LongDateTime)}
					Uptime: ${ms(this.client.uptime)}
					Discord.js v${version}
				`,
			}, {
				name: 'Cache',
				value: stripIndents`
					Guilds: ${this.client.formatNumber(this.client.guilds.cache.size)}
					Channels: ${this.client.formatNumber(this.client.channels.cache.size)}
					Members: ${this.client.formatNumber(this.client.guilds.cache.reduce((acc, guild) => acc + guild.members.cache.size, 0))}
					Users: ${this.client.formatNumber(this.client.users.cache.size)}
					Messages: ${this.client.formatNumber(this.client.channels.cache.reduce((acc, channel) => acc + (channel.messages?.cache.size ?? 0), 0))}
				`,
			}, {
				name: 'Memory',
				value: memoryInfo,
			})
			.setFooter(interaction.guild?.me.displayName ?? this.client.user.username, this.client.user.displayAvatarURL());

		return interaction.reply({
			embeds: [
				embed,
			],
		});
	}
};
