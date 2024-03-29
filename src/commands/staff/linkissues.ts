import {
	bold,
	escapeMarkdown,
	SlashCommandBuilder,
	userMention,
	type ChatInputCommandInteraction,
	type GuildMember,
} from 'discord.js';
import { escapeIgn, splitMessage } from '#functions';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand.js';
import type { CommandContext } from '#structures/commands/BaseCommand.js';
import { hypixelGuildOption } from '#structures/commands/commonOptions.js';
import { GuildMemberUtil, GuildUtil, InteractionUtil } from '#utils';

interface IssueInfo {
	amount: number;
	values: string[];
}

export default class LinkIssuesCommand extends ApplicationCommand {
	public constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription('list player db and discord role discrepancies')
				.addStringOption(hypixelGuildOption),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 */
	public override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		// discord members with wrong roles
		const hypixelGuild = InteractionUtil.getHypixelGuild(interaction);
		const guild = hypixelGuild.discordGuild;
		const discordGuild = this.client.discordGuilds.cache.get(hypixelGuild.discordId!);
		// eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
		const mandatoryRole = guild?.roles.cache.get(discordGuild?.MANDATORY_ROLE_ID!);
		const missingMandatoryRole: GuildMember[] = [];
		const guildRoleAndNotInGuild: GuildMember[] = [];

		for (const member of (await GuildUtil.fetchAllMembers(guild)).values()) {
			// member is linked to a player in the hypixel guild
			if (GuildMemberUtil.getPlayer(member)?.guildId === hypixelGuild.guildId) {
				if (mandatoryRole && !member.roles.cache.has(mandatoryRole.id)) {
					missingMandatoryRole.push(member);
				}

				continue;
			}

			// eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
			if (member.roles.cache.hasAny(discordGuild?.GUILD_ROLE_ID!, hypixelGuild.GUILD_ROLE_ID!)) {
				guildRoleAndNotInGuild.push(member);
			}
		}

		let issuesAmount = missingMandatoryRole.length + guildRoleAndNotInGuild.length;

		const embed = this.client.defaultEmbed.setFooter({ text: hypixelGuild.name });

		if (missingMandatoryRole.length) {
			for (const value of splitMessage(
				missingMandatoryRole
					.map((member) => `${member} | ${escapeMarkdown(`${member.displayName} | ${member.user.tag}`)}`)
					.join('\n'),
				{ char: '\n', maxLength: 1_024 },
			)) {
				embed.addFields({
					name: `${bold(`Missing ${mandatoryRole!.name} Role:`)} [display name | tag] (${missingMandatoryRole.length})`,
					value,
				});
			}
		} else if (mandatoryRole) {
			embed.addFields({
				name: bold(`Missing ${mandatoryRole.name} Role:`),
				value: 'none',
			});
		}

		if (guildRoleAndNotInGuild.length) {
			for (const value of splitMessage(
				guildRoleAndNotInGuild
					.map((member) => `${member} | ${escapeMarkdown(`${member.displayName} | ${member.user.tag}`)}`)
					.join('\n'),
				{ char: '\n', maxLength: 1_024 },
			)) {
				embed.addFields({
					name: `${bold('Guild Role and no linked Player:')} [display name | tag] (${guildRoleAndNotInGuild.length})`,
					value,
				});
			}
		} else {
			embed.addFields({
				name: bold('Guild Role and no linked Player:'),
				value: 'none',
			});
		}

		// guild players that are either unlinked or not in the discord server
		const unlinkedPlayers: IssueInfo[] = [];
		const linkedAndNotInDiscord: IssueInfo[] = [];

		// db entries with issues
		const [unlinkedGuildPlayers, linkedPlayers] = hypixelGuild.players.partition(
			({ discordId }) => discordId === null || /\D/.test(discordId),
		);
		const linkedAndNotInDiscordCurrentGuild = linkedPlayers.filter(({ inDiscord }) => !inDiscord);
		const UNLINKED_AMOUNT = unlinkedGuildPlayers.size;
		const LINKED_NOT_DISCORD_AMOUNT = linkedAndNotInDiscordCurrentGuild.size;

		issuesAmount += UNLINKED_AMOUNT + LINKED_NOT_DISCORD_AMOUNT;

		unlinkedPlayers.push({
			amount: UNLINKED_AMOUNT,
			values: UNLINKED_AMOUNT
				? splitMessage(
						unlinkedGuildPlayers
							.map(
								({ ign, discordId }) => `${escapeIgn(ign)} | ${discordId ? escapeMarkdown(discordId) : 'unknown tag'}`,
							)
							.join('\n'),
						{ char: '\n', maxLength: 1_024 },
				  )
				: ['none'],
		});

		linkedAndNotInDiscord.push({
			amount: LINKED_NOT_DISCORD_AMOUNT,
			values: LINKED_NOT_DISCORD_AMOUNT
				? splitMessage(
						linkedAndNotInDiscordCurrentGuild
							.map(({ discordId, ign }) => `${userMention(discordId!)} | ${escapeIgn(ign)}`)
							.join('\n'),
						{ char: '\n', maxLength: 1_024 },
				  )
				: ['none'],
		});

		for (const { amount, values } of unlinkedPlayers) {
			for (const value of values) {
				embed.addFields({
					name: `${bold('Unlinked Players:')}${amount ? ` [ign | tag] (${amount})` : ''}`,
					value,
				});
			}
		}

		for (const { amount, values } of linkedAndNotInDiscord) {
			for (const value of values) {
				embed.addFields({
					name: `${bold('Linked and not in Discord:')}${amount ? ` (${amount})` : ''}`,
					value,
				});
			}
		}

		embed.setTitle(`Link Issues${issuesAmount ? ` (${issuesAmount})` : ''}`);

		return InteractionUtil.reply(interaction, {
			embeds: [embed],
		});
	}
}
