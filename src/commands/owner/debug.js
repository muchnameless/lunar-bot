'use strict';

const { Formatters, SnowflakeUtil, version } = require('discord.js');
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
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		return interaction.reply({
			embeds: [
				this.client.defaultEmbed
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
							${this.client.channels.cache
								.filter(c => c.type === 'DM')
								.map(c => [ c.recipient.tag ?? c.recipient.id, SnowflakeUtil.deconstruct(c.lastMessageId).date ])
								.sort(([ , a ], [ , b ]) => b - a)
								.map(([ name, date ]) => Formatters.quote(`${name ?? 'unknown channel'}: ${Formatters.time(date, Formatters.TimestampStyles.LongDateTime)}`))
								.join('\n')}
							Members: ${this.client.formatNumber(this.client.guilds.cache.reduce((acc, guild) => acc + guild.members.cache.size, 0))}
							Users: ${this.client.formatNumber(this.client.users.cache.size)}
							Messages: ${this.client.formatNumber(this.client.channels.cache.reduce((acc, channel) => acc + (channel.messages?.cache.size ?? 0), 0))}
							${this.client.channels.cache
								.filter(c => c.messages?.cache.size)
								.sort((a, b) => b.messages.cache.size - a.messages.cache.size)
								.map(c => Formatters.quote(`${c.type !== 'DM' ? `${c}` : c.recipient?.tag ?? 'unknown channel'}: ${this.client.formatNumber(c.messages.cache.size)}`))
								.join('\n')}
						`.replace(/\n{2,}/g, '\n'),
					}, {
						name: 'Memory',
						value: Object.entries(process.memoryUsage())
							.map(([ key, value ]) => `${key}: ${Math.round(value / 1024 / 1024 * 100) / 100} MB`)
							.join('\n'),
					}, {
						name: 'Imgur Rate Limits',
						value: stripIndents`
							${Object.entries(this.client.imgur.rateLimit)
								.map(([ key, value ]) => `${key}: ${value}`)
								.join('\n')}
							${Object.entries(this.client.imgur.postRateLimit)
								.map(([ key, value ]) => `post${key}: ${value}`)
								.join('\n')}
						`,
					})
					.setFooter(interaction.guild?.me.displayName ?? this.client.user.username, this.client.user.displayAvatarURL()),
			],
		});
	}
};
