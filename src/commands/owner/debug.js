import { SlashCommandBuilder } from '@discordjs/builders';
import { Formatters, SnowflakeUtil, Util, version } from 'discord.js';
import { stripIndents } from 'common-tags';
import ms from 'ms';
import { EMBED_FIELD_MAX_CHARS } from '../../constants/index.js';
import { InteractionUtil } from '../../util/index.js';
import { escapeIgn, trim } from '../../functions/index.js';
import { SlashCommand } from '../../structures/commands/SlashCommand.js';


export default class DebugCommand extends SlashCommand {
	constructor(context) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('shows general information about the bot'),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async runSlash(interaction) {
		return await InteractionUtil.reply(interaction, {
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
								.map(c => [ c.recipient.tag ?? c.recipient.id, SnowflakeUtil.deconstruct(c.lastMessageId ?? '').date ])
								.sort(([ , a ], [ , b ]) => b - a)
								.map(([ name, date ]) => Formatters.quote(`${name ?? 'unknown channel'}: ${Formatters.time(date, Formatters.TimestampStyles.LongDateTime)}`))
								.join('\n')}
							${this.client.channels.cache
								.filter(c => c.isThread())
								.map(c => [ c, SnowflakeUtil.deconstruct(c.lastMessageId ?? '').date ])
								.sort(([ , a ], [ , b ]) => b - a)
								.map(([ c, date ]) => Formatters.quote(`${c ?? 'unknown channel'}: ${Formatters.time(date, Formatters.TimestampStyles.LongDateTime)}`))
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
								.map(([ key, value ]) => `${key}: ${key.endsWith('reset') && value !== null ? Formatters.time(value, Formatters.TimestampStyles.LongDateTime) : value}`)
								.join('\n')}
							${Object.entries(this.client.imgur.postRateLimit)
								.map(([ key, value ]) => `post${key}: ${key.endsWith('reset') && value !== null ? Formatters.time(new Date(value), Formatters.TimestampStyles.LongDateTime) : value}`)
								.join('\n')}
						`,
					}, {
						name: 'Chat Bridge Cache',
						value: trim(this.client.chatBridges.map(cb => stripIndents`
							bot: ${escapeIgn(cb.bot?.username ?? 'offline')}
							current index: ${cb.minecraft?._lastMessages.index ?? 'offline'}
							Messages:
							${cb.minecraft?._lastMessages.cache.map(x => Formatters.quote(Util.escapeMarkdown(x))).join('\n') ?? 'offline'}
						`).join('\n\n'), EMBED_FIELD_MAX_CHARS),
					})
					.setFooter(interaction.guild?.me.displayName ?? this.client.user.username, this.client.user.displayAvatarURL()),
			],
		});
	}
}
