import process from 'node:process';
import { SlashCommandBuilder } from '@discordjs/builders';
import { Formatters, MessageActionRow, SnowflakeUtil, version } from 'discord.js';
import { stripIndents } from 'common-tags';
import ms from 'ms';
import { EMBED_FIELD_MAX_CHARS } from '../../constants';
import { hypixel, imgur } from '../../api';
import { InteractionUtil } from '../../util';
import { escapeIgn, formatNumber, trim } from '../../functions';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
import type { Collection, CommandInteraction, DMChannel, Snowflake, TextBasedChannel, ThreadChannel } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';

export default class DebugCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder().setDescription('shows general information about the bot'),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		const { guilds, channels, players } = this.client;
		const me = interaction.guild?.me ?? null;

		return InteractionUtil.reply(interaction, {
			embeds: [
				this.client.defaultEmbed
					.addFields(
						{
							name: 'General',
							value: stripIndents`
								Ready at: ${Formatters.time(this.client.readyAt!, Formatters.TimestampStyles.LongDateTime)}
								Uptime: ${ms(this.client.uptime!)}
								Discord.js v${version}
								Node.js ${process.version}
							`,
						},
						{
							name: 'Cache',
							value: stripIndents`
								Guilds: ${formatNumber(guilds.cache.size)}
								Channels: ${formatNumber(channels.cache.size)} (${formatNumber(
								channels.cache.filter((c) => c.isThread() || c.type === 'DM').size,
							)} temporary)
								${(channels.cache.filter((c) => c.type === 'DM') as Collection<Snowflake, DMChannel>)
									.map(
										(c) =>
											[
												c.recipient.tag ?? c.recipient.id,
												SnowflakeUtil.deconstruct(c.lastMessageId ?? '').date,
											] as const,
									)
									.sort(([, a], [, b]) => b.getTime() - a.getTime())
									.map(([name, date]) =>
										Formatters.quote(
											`${name ?? 'unknown channel'}: ${Formatters.time(date, Formatters.TimestampStyles.LongDateTime)}`,
										),
									)
									.join('\n')}
								${(channels.cache.filter((c) => c.isThread()) as Collection<Snowflake, ThreadChannel>)
									.map((c) => [c, SnowflakeUtil.deconstruct(c.lastMessageId ?? '').date] as const)
									.sort(([, a], [, b]) => b.getTime() - a.getTime())
									.map(([c, date]) =>
										Formatters.quote(
											`${c ?? 'unknown channel'}: ${Formatters.time(date, Formatters.TimestampStyles.LongDateTime)}`,
										),
									)
									.join('\n')}
								Members: ${formatNumber(guilds.cache.reduce((acc, guild) => acc + guild.members.cache.size, 0))}
								Users: ${formatNumber(this.client.users.cache.size)}
								Messages: ${formatNumber(
									channels.cache.reduce(
										(acc, channel) => acc + ((channel as TextBasedChannel).messages?.cache.size ?? 0),
										0,
									),
								)}
								${(
									channels.cache.filter((c) => Boolean((c as TextBasedChannel).messages?.cache.size)) as Collection<
										Snowflake,
										TextBasedChannel
									>
								)
									.sort(
										(
											{
												messages: {
													cache: { size: a },
												},
											},
											{
												messages: {
													cache: { size: b },
												},
											},
										) => b - a,
									)
									.map((c) =>
										Formatters.quote(
											`${c.type !== 'DM' ? `${c}` : c.recipient?.tag ?? 'unknown channel'}: ${formatNumber(
												c.messages.cache.size,
											)}`,
										),
									)
									.join('\n')}
								DiscordGuilds: ${formatNumber(this.client.discordGuilds.cache.size)}
								HypixelGuilds: ${formatNumber(this.client.hypixelGuilds.cache.size)}
								Players: ${formatNumber(players.cache.size)}
								${Formatters.quote(`not inGuild: ${formatNumber(players.cache.filter((p) => !p.inGuild()).size)}`)}
								${Formatters.quote(
									`cached DiscordMember: ${formatNumber(
										// @ts-expect-error _discordMember is private
										players.cache.filter((p) => p._discordMember).size,
									)}`,
								)}
								${Formatters.quote(
									`incorrectly cached: ${formatNumber(
										players.cache.filter(
											(p) =>
												// @ts-expect-error
												p._discordMember &&
												// @ts-expect-error
												p._discordMember !== p.hypixelGuild?.discordGuild?.members.cache.get(p._discordMember.id),
										).size,
									)}`,
								)}
							`.replace(/\n{2,}/g, '\n'),
						},
						{
							name: 'Memory',
							value: Object.entries(process.memoryUsage())
								.map(([key, value]) => `${key}: ${Math.round((value / 1_024 / 1_024) * 100) / 100} MB`)
								.join('\n'),
						},
						{
							name: 'Hypixel',
							// @ts-expect-error
							value: `Queue: ${hypixel.queue.promises.length}`,
						},
						{
							name: 'Imgur',
							value: stripIndents`
								Rate Limits
								${Object.entries(imgur.rateLimit)
									.map(([key, value]: [string, number | null]) =>
										Formatters.quote(
											`${key}: ${
												key.endsWith('reset') && value !== null
													? Formatters.time(new Date(value), Formatters.TimestampStyles.LongDateTime)
													: value
											}`,
										),
									)
									.join('\n')}
								${Object.entries(imgur.postRateLimit)
									.map(([key, value]: [string, number | null]) =>
										Formatters.quote(
											`post${key}: ${
												key.endsWith('reset') && value !== null
													? Formatters.time(new Date(value), Formatters.TimestampStyles.LongDateTime)
													: value
											}`,
										),
									)
									.join('\n')}
								Queue: ${imgur.queue.remaining}
							`,
						},
						{
							name: 'Chat Bridges',
							value:
								trim(
									(
										await Promise.all(
											this.client.chatBridges.cache.map(
												async (cb) => stripIndents`
													Bot: ${escapeIgn(cb.bot?.username ?? 'offline')}
													HypixelGuild: ${cb.hypixelGuild?.name ?? 'not linked'}
													Server: ${await cb.minecraft.server}
													Queues:
													${Formatters.quote(`Minecraft: ${cb.minecraft.queue.remaining}`)}
													${cb.discord.channelsByType.map((c) => Formatters.quote(`${c.channel}: ${c.queue.remaining}`)).join('\n')}
												`,
											),
										)
									).join('\n\n'),
									EMBED_FIELD_MAX_CHARS,
								) || 'disabled',
						},
					)
					.setFooter({
						text: me?.displayName ?? this.client.user!.username,
						iconURL: (me ?? this.client.user!).displayAvatarURL(),
					}),
			],
			components: [new MessageActionRow().addComponents(InteractionUtil.getDeleteButton(interaction))],
		});
	}
}
