import { SlashCommandBuilder } from '@discordjs/builders';
import { Formatters, Util } from 'discord.js';
import { GuildUtil, InteractionUtil } from '../../util';
import { escapeIgn } from '../../functions';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
import type { CommandInteraction, GuildMember } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';

interface IssueInfo {
	guildName: string;
	amount: number;
	values: string[];
}

export default class LinkIssuesCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder().setDescription('list player db and discord role discrepancies'),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		// discord members with wrong roles
		const hypixelGuild = InteractionUtil.getHypixelGuild(interaction);
		const { discordGuild } = hypixelGuild;
		const mandatoryRole = discordGuild?.roles.cache.get(hypixelGuild.roleIds.MANDATORY!);
		const { GUILD } = hypixelGuild.roleIds;
		const missingMandatoryRole: GuildMember[] = [];
		const guildRoleWithoutDbEntry: GuildMember[] = [];

		for (const [DISCORD_ID, member] of await GuildUtil.fetchAllMembers(discordGuild)) {
			if (this.client.players.cache.some(({ discordId }) => discordId === DISCORD_ID)) {
				if (mandatoryRole && !member.roles.cache.has(mandatoryRole.id)) missingMandatoryRole.push(member);
				continue;
			}

			if (member.roles.cache.has(GUILD!)) guildRoleWithoutDbEntry.push(member);
		}

		let issuesAmount = missingMandatoryRole.length + guildRoleWithoutDbEntry.length;

		const embed = this.client.defaultEmbed;

		if (missingMandatoryRole.length) {
			for (const value of Util.splitMessage(
				missingMandatoryRole
					.map((member) => `${member} | ${Util.escapeMarkdown(`${member.displayName} | ${member.user.tag}`)}`)
					.join('\n'),
				{ char: '\n', maxLength: 1_024 },
			)) {
				embed.addFields({
					name: `${Formatters.bold(`Missing ${mandatoryRole!.name} Role:`)} [display name | tag] (${
						missingMandatoryRole.length
					})`,
					value,
				});
			}
		} else if (mandatoryRole) {
			embed.addFields({
				name: Formatters.bold(`Missing ${mandatoryRole.name} Role:`),
				value: 'none',
			});
		}

		if (guildRoleWithoutDbEntry.length) {
			for (const value of Util.splitMessage(
				guildRoleWithoutDbEntry
					.map((member) => `${member} | ${Util.escapeMarkdown(`${member.displayName} | ${member.user.tag}`)}`)
					.join('\n'),
				{ char: '\n', maxLength: 1_024 },
			)) {
				embed.addFields({
					name: `${Formatters.bold('Guild Role and no DB entry:')} [display name | tag] (${
						guildRoleWithoutDbEntry.length
					})`,
					value,
				});
			}
		} else {
			embed.addFields({
				name: Formatters.bold('Guild Role and no DB entry:'),
				value: 'none',
			});
		}

		// guild players that are either unlinked or not in the discord server
		const unlinkedPlayers: IssueInfo[] = [];
		const linkedAndNotInDiscord: IssueInfo[] = [];

		for (const { name, players: guildPlayers } of this.client.hypixelGuilds.cache.values()) {
			// db entries with issues
			const [unlinkedGuildPlayers, linkedPlayers] = guildPlayers.partition(({ discordId }) => /\D/.test(discordId!));
			const linkedAndNotInDiscordCurrentGuild = linkedPlayers.filter(({ inDiscord }) => !inDiscord);
			const UNLINKED_AMOUNT = unlinkedGuildPlayers.size;
			const LINKED_NOT_DISCORD_AMOUNT = linkedAndNotInDiscordCurrentGuild.size;

			issuesAmount += UNLINKED_AMOUNT + LINKED_NOT_DISCORD_AMOUNT;

			unlinkedPlayers.push({
				guildName: name,
				amount: UNLINKED_AMOUNT,
				values: UNLINKED_AMOUNT
					? Util.splitMessage(
							unlinkedGuildPlayers
								.map(
									({ ign, discordId }) =>
										`${escapeIgn(ign)} | ${discordId ? Util.escapeMarkdown(discordId) : 'unknown tag'}`,
								)
								.join('\n'),
							{ char: '\n', maxLength: 1_024 },
					  )
					: ['none'],
			});

			linkedAndNotInDiscord.push({
				guildName: name,
				amount: LINKED_NOT_DISCORD_AMOUNT,
				values: LINKED_NOT_DISCORD_AMOUNT
					? Util.splitMessage(
							linkedAndNotInDiscordCurrentGuild
								.map(({ discordId, ign }) => `${Formatters.userMention(discordId!)} | ${escapeIgn(ign)}`)
								.join('\n'),
							{ char: '\n', maxLength: 1_024 },
					  )
					: ['none'],
			});
		}

		for (const { guildName, amount, values } of unlinkedPlayers)
			for (const value of values) {
				embed.addFields({
					name: `${Formatters.bold(`Unlinked Players (${guildName}):`)}${amount ? ` [ign | tag] (${amount})` : ''}`,
					value,
				});
			}

		for (const { guildName, amount, values } of linkedAndNotInDiscord)
			for (const value of values) {
				embed.addFields({
					name: `${Formatters.bold(`Linked and not in Discord (${guildName}):`)}${amount ? ` (${amount})` : ''}`,
					value,
				});
			}

		embed.setTitle(`Link Issues${issuesAmount ? ` (${issuesAmount})` : ''}`);

		return InteractionUtil.reply(interaction, {
			embeds: [embed],
		});
	}
}
