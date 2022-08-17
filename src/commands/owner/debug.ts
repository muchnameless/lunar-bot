import { env, memoryUsage, version as processVersion } from 'node:process';
import {
	ActionRowBuilder,
	ChannelType,
	quote,
	SlashCommandBuilder,
	SnowflakeUtil,
	time,
	TimestampStyles,
	version as djsVersion,
} from 'discord.js';
import { stripIndents } from 'common-tags';
import { EmbedLimits } from '@sapphire/discord-utilities';
import ms from 'ms';
import { InteractionUtil } from '#utils';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand';
import { hypixel, imgur } from '#api';
import { escapeIgn, formatNumber, buildDeleteButton, trim } from '#functions';
import type {
	ChatInputCommandInteraction,
	Collection,
	DMChannel,
	MessageActionRowComponentBuilder,
	Snowflake,
	TextBasedChannel,
	ThreadChannel,
} from 'discord.js';
import type { CommandContext } from '#structures/commands/BaseCommand';

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
	override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		const { guilds, channels, players } = this.client;
		const me = interaction.guild?.members.me ?? null;

		return InteractionUtil.reply(interaction, {
			embeds: [
				this.client.defaultEmbed
					.addFields(
						{
							name: 'General',
							value: stripIndents`
								Ready at: ${time(this.client.readyTimestamp!, TimestampStyles.LongDateTime)}
								Uptime: ${ms(this.client.uptime!)}
								Discord.js v${djsVersion}
								Node.js ${processVersion}
								Env: ${env.NODE_ENV}
							`,
						},
						{
							name: 'Cache',
							value: stripIndents`
								Guilds: ${formatNumber(guilds.cache.size)}
								Channels: ${formatNumber(channels.cache.size)} (${formatNumber(
								channels.cache.filter((c) => c.isThread() || c.type === ChannelType.DM).size,
							)} temporary)
								${(channels.cache.filter((c) => c.type === ChannelType.DM) as Collection<Snowflake, DMChannel>)
									.map(
										(c) =>
											[c.recipient?.tag ?? c.recipientId, SnowflakeUtil.timestampFrom(c.lastMessageId ?? '')] as const,
									)
									.sort(([, a], [, b]) => b - a)
									.map(([name, timestamp]) =>
										quote(`${name ?? 'unknown channel'}: ${time(timestamp, TimestampStyles.LongDateTime)}`),
									)
									.join('\n')}
								${(channels.cache.filter((c) => c.isThread()) as Collection<Snowflake, ThreadChannel>)
									.map((c) => [c, SnowflakeUtil.timestampFrom(c.lastMessageId ?? '')] as const)
									.sort(([, a], [, b]) => b - a)
									.map(([c, timestamp]) =>
										quote(`${c ?? 'unknown channel'}: ${time(timestamp, TimestampStyles.LongDateTime)}`),
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
										quote(
											`${c.type !== ChannelType.DM ? `${c}` : c.recipient?.tag ?? 'unknown channel'}: ${formatNumber(
												c.messages.cache.size,
											)}`,
										),
									)
									.join('\n')}
								DiscordGuilds: ${formatNumber(this.client.discordGuilds.cache.size)}
								HypixelGuilds: ${formatNumber(this.client.hypixelGuilds.cache.size)}
								Players: ${formatNumber(players.cache.size)}
								${quote(`not inGuild: ${formatNumber(players.cache.filter((p) => !p.inGuild()).size)}`)}
								${quote(
									`cached DiscordMember: ${formatNumber(
										// @ts-expect-error _discordMember is private
										players.cache.filter((p) => p._discordMember).size,
									)}`,
								)}
								${quote(
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
							value: Object.entries(memoryUsage())
								.map(([key, value]) => `${key}: ${Math.round((value / 1_024 / 1_024) * 100) / 100} MB`)
								.join('\n'),
						},
						{
							name: 'Hypixel',
							// @ts-expect-error
							value: `Queue: ${hypixel.queue.remaining}`,
						},
						{
							name: 'Imgur',
							value: stripIndents`
								Rate Limits
								${Object.entries(imgur.rateLimit)
									.map(([key, value]: [string, number | null]) =>
										quote(
											`${key}: ${
												key.endsWith('reset') && value !== null ? time(value, TimestampStyles.LongDateTime) : value
											}`,
										),
									)
									.join('\n')}
								${Object.entries(imgur.postRateLimit)
									.map(([key, value]: [string, number | null]) =>
										quote(
											`post${key}: ${
												key.endsWith('reset') && value !== null ? time(value, TimestampStyles.LongDateTime) : value
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
													${quote(`Minecraft: ${cb.minecraft.queue.remaining}`)}
													${cb.discord.channelsByType.map((c) => quote(`${c.channel}: ${c.queue.remaining}`)).join('\n')}
												`,
											),
										)
									).join('\n\n'),
									EmbedLimits.MaximumFieldValueLength,
								) || 'disabled',
						},
					)
					.setFooter({
						text: me?.displayName ?? this.client.user!.username,
						iconURL: (me ?? this.client.user!).displayAvatarURL(),
					}),
			],
			components: [
				new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(buildDeleteButton(interaction.user.id)),
			],
		});
	}
}
