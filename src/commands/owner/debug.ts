import { env, memoryUsage, version as processVersion } from 'node:process';
import { EmbedLimits } from '@sapphire/discord-utilities';
import { stripIndents } from 'common-tags';
import {
	ActionRowBuilder,
	ChannelType,
	quote,
	SlashCommandBuilder,
	SnowflakeUtil,
	time,
	TimestampStyles,
	version as djsVersion,
	type ButtonBuilder,
	type ChatInputCommandInteraction,
	type Collection,
	type DMChannel,
	type Snowflake,
	type TextBasedChannel,
	type ThreadChannel,
} from 'discord.js';
import ms from 'ms';
import { hypixel, imgur, mojang } from '#api';
import { buildDeleteButton, escapeIgn, formatNumber, seconds, trim } from '#functions';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand.js';
import { type CommandContext } from '#structures/commands/BaseCommand.js';
import { InteractionUtil } from '#utils';

export default class DebugCommand extends ApplicationCommand {
	public constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder().setDescription('shows general information about the bot'),
			cooldown: 0,
		});
	}

	/**
	 * @param api
	 */
	private _getRateLimitInfo(api: typeof hypixel | typeof mojang) {
		const rateLimit = api.rateLimitManager.acquire('global');

		return stripIndents`
			Rate Limit
			${quote(`remaining: ${rateLimit.remaining}`)}
			${quote(`reset: ${time(seconds.fromMilliseconds(rateLimit.expires), TimestampStyles.LongDateTime)}`)}
			${quote(`limit: ${api.rateLimitManager.limit}`)}
			Queue: ${api.queue.remaining}
		`;
	}

	/**
	 * @param managerName
	 */
	private _getImgurRateLimitInfo(managerName: 'client' | 'post' | 'user') {
		const { manager } = imgur.rateLimitManagers[managerName === 'user' ? 0 : managerName === 'client' ? 1 : 2];
		const rateLimit = manager.acquire('global');

		return [
			quote(managerName),
			quote(`remaining: ${rateLimit.remaining}`),
			quote(`reset: ${time(seconds.fromMilliseconds(rateLimit.expires), TimestampStyles.LongDateTime)}`),
			quote(`limit: ${manager.limit}`),
		].join('\n');
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 */
	public override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		const { guilds, channels, players } = this.client;
		const me = interaction.guild?.members.me ?? null;

		return InteractionUtil.reply(interaction, {
			embeds: [
				this.client.defaultEmbed
					.addFields(
						{
							name: 'General',
							value: stripIndents`
								Ready at: ${time(seconds.fromMilliseconds(this.client.readyTimestamp!), TimestampStyles.LongDateTime)}
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
								channels.cache.filter((channel) => channel.isThread() || channel.type === ChannelType.DM).size,
							)} temporary)
								${(channels.cache.filter((channel) => channel.type === ChannelType.DM) as Collection<Snowflake, DMChannel>)
									.map(
										(channel) =>
											[
												channel.recipient?.tag ?? channel.recipientId,
												SnowflakeUtil.timestampFrom(channel.lastMessageId ?? ''),
											] as const,
									)
									.sort(([, a], [, b]) => b - a)
									.map(([name, timestamp]) =>
										quote(`${name}: ${time(seconds.fromMilliseconds(timestamp), TimestampStyles.LongDateTime)}`),
									)
									.join('\n')}
								${(channels.cache.filter((channel) => channel.isThread()) as Collection<Snowflake, ThreadChannel>)
									.map((channel) => [channel, SnowflakeUtil.timestampFrom(channel.lastMessageId ?? '')] as const)
									.sort(([, a], [, b]) => b - a)
									.map(([channel, timestamp]) =>
										quote(`${channel}: ${time(seconds.fromMilliseconds(timestamp), TimestampStyles.LongDateTime)}`),
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
									channels.cache.filter((channel) =>
										Boolean((channel as TextBasedChannel).messages?.cache.size),
									) as Collection<Snowflake, TextBasedChannel>
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
									.map((channel) =>
										quote(
											`${
												channel.type === ChannelType.DM ? channel.recipient?.tag ?? 'unknown channel' : `${channel}`
											}: ${formatNumber(channel.messages.cache.size)}`,
										),
									)
									.join('\n')}
								DiscordGuilds: ${formatNumber(this.client.discordGuilds.cache.size)}
								HypixelGuilds: ${formatNumber(this.client.hypixelGuilds.cache.size)}
								Players: ${formatNumber(players.cache.size)}
								${quote(`not inGuild: ${formatNumber(players.cache.filter((player) => !player.inGuild()).size)}`)}
								${quote(
									`cached DiscordMember: ${formatNumber(
										// @ts-expect-error _discordMember is private
										players.cache.filter((player) => player._discordMember).size,
									)}`,
								)}
								${quote(
									`incorrectly cached: ${formatNumber(
										players.cache.filter(
											(player) =>
												// @ts-expect-error private
												player._discordMember &&
												// @ts-expect-error private
												player._discordMember !==
													// @ts-expect-error private
													player.hypixelGuild?.discordGuild?.members.cache.get(player._discordMember.id),
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
							name: 'Mojang',
							value: this._getRateLimitInfo(mojang),
						},
						{
							name: 'Hypixel',
							value: this._getRateLimitInfo(hypixel),
						},
						{
							name: 'Imgur',
							value: stripIndents`
								Rate Limits
								${this._getImgurRateLimitInfo('user')}
								${this._getImgurRateLimitInfo('client')}
								${this._getImgurRateLimitInfo('post')}
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
													${cb.discord.channelsByType.map((manager) => quote(`${manager.channel}: ${manager.queue.remaining}`)).join('\n')}
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
			components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buildDeleteButton(interaction.user.id))],
		});
	}
}
