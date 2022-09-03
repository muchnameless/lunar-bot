import { setTimeout as sleep } from 'node:timers/promises';
import { SlashCommandBuilder, type ChatInputCommandInteraction, type Snowflake } from 'discord.js';
import ms from 'ms';
import { seconds } from '#functions';
import { logger } from '#logger';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand.js';
import { type CommandContext } from '#structures/commands/BaseCommand.js';
import { hypixelGuildOption } from '#structures/commands/commonOptions.js';
import { GuildMemberUtil, GuildUtil, InteractionUtil } from '#utils';

export default class PurgeRolesCommand extends ApplicationCommand {
	public constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription('removes all roles that the bot manages from non guild members')
				.addStringOption(hypixelGuildOption),
			cooldown: 0,
		});
	}

	private static readonly running = new Set<Snowflake>();

	/**
	 * time to wait between role API requests
	 */
	private static readonly TIMEOUT = seconds(30);

	/**
	 * execute the command
	 *
	 * @param interaction
	 */
	public override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		const { discordGuild: guild } = InteractionUtil.getHypixelGuild(interaction);

		if (!guild) {
			throw 'unable to determine the guild';
		}

		if (PurgeRolesCommand.running.has(guild.id)) {
			throw 'the command is already running';
		}

		try {
			PurgeRolesCommand.running.add(guild.id);

			const GUILD_ROLE_ID = this.client.discordGuilds.cache.get(guild.id)?.GUILD_ROLE_ID;
			const toPurge: { rolesToPurge: Snowflake[]; userId: Snowflake }[] = [];

			for (const member of (await GuildUtil.fetchAllMembers(guild)).values()) {
				if (member.roles.cache.has(GUILD_ROLE_ID!)) continue;

				const rolesToPurge = GuildMemberUtil.getRolesToPurge(member);

				if (!rolesToPurge.length) continue;

				toPurge.push({
					userId: member.id,
					rolesToPurge,
				});
			}

			const PURGE_AMOUNT = toPurge.length;

			if (!PURGE_AMOUNT) return InteractionUtil.reply(interaction, 'no roles need to be purged');

			await InteractionUtil.awaitConfirmation(
				interaction,
				`purge roles from ${PURGE_AMOUNT} member${PURGE_AMOUNT === 1 ? '' : 's'}, expected duration: ${ms(
					(PURGE_AMOUNT - 1) * PurgeRolesCommand.TIMEOUT,
					{ long: true },
				)}?`,
			);

			let success = 0;

			for (const { userId, rolesToPurge } of toPurge) {
				await sleep(PurgeRolesCommand.TIMEOUT);

				const member = guild.members.cache.get(userId);
				if (!member) continue;

				await member.roles.remove(rolesToPurge);

				++success;

				logger.info(
					`[PURGE ROLES]: removed ${rolesToPurge.length} role(s) from ${member.user.tag} | ${member.displayName}`,
				);
			}

			return InteractionUtil.reply(
				interaction,
				`done, purged roles from ${success}/${PURGE_AMOUNT} member${PURGE_AMOUNT === 1 ? '' : 's'}`,
			);
		} finally {
			PurgeRolesCommand.running.delete(guild.id);
		}
	}
}
