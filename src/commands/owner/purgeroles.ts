import { setTimeout as sleep } from 'node:timers/promises';
import { SlashCommandBuilder } from '@discordjs/builders';
import ms from 'ms';
import { GuildMemberUtil, GuildUtil, InteractionUtil } from '../../util';
import { logger, seconds } from '../../functions';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
import { hypixelGuildOption } from '../../structures/commands/commonOptions';
import type { CommandInteraction, Snowflake } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';

export default class PurgeRolesCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription('removes all roles that the bot manages from non guild members')
				.addStringOption(hypixelGuildOption),
			cooldown: 0,
		});
	}

	static running = new Set<Snowflake>();

	/**
	 * time to wait between role API requests
	 */
	static TIMEOUT = seconds(30);

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		const hypixelGuild = InteractionUtil.getHypixelGuild(interaction);
		const { discordGuild } = hypixelGuild;

		if (!discordGuild) {
			return InteractionUtil.reply(interaction, {
				content: 'unable to determine the guild',
				ephemeral: true,
			});
		}

		if (PurgeRolesCommand.running.has(discordGuild.id)) {
			return InteractionUtil.reply(interaction, {
				content: 'the command is already running',
				ephemeral: true,
			});
		}

		try {
			PurgeRolesCommand.running.add(discordGuild.id);

			const { GUILD } = hypixelGuild.roleIds;
			const toPurge: { id: Snowflake; rolesToPurge: Snowflake[] }[] = [];

			for (const member of (await GuildUtil.fetchAllMembers(discordGuild)).values()) {
				if (member.roles.cache.has(GUILD)) continue;

				const rolesToPurge = GuildMemberUtil.getRolesToPurge(member);

				if (!rolesToPurge.length) continue;

				toPurge.push({
					id: member.id,
					rolesToPurge,
				});
			}

			const PURGE_AMOUNT = toPurge.length;

			if (!PURGE_AMOUNT) return InteractionUtil.reply(interaction, 'no roles need to be purged');

			await InteractionUtil.awaitConfirmation(
				interaction,
				`purge roles from ${PURGE_AMOUNT} member${PURGE_AMOUNT !== 1 ? 's' : ''}, expected duration: ${ms(
					(PURGE_AMOUNT - 1) * PurgeRolesCommand.TIMEOUT,
					{ long: true },
				)}?`,
			);

			await Promise.all(
				toPurge.map(async ({ id, rolesToPurge }, index) => {
					await sleep(index * PurgeRolesCommand.TIMEOUT);

					try {
						const member = discordGuild.members.cache.get(id);
						if (!member || member.deleted) return;

						await member.roles.remove(rolesToPurge);

						logger.info(
							`[PURGE ROLES]: removed ${rolesToPurge.length} role(s) from ${member.user.tag} | ${member.displayName}`,
						);
					} catch (error) {
						logger.error(error, '[PURGE ROLES]');
					}
				}),
			);

			return InteractionUtil.reply(
				interaction,
				`done, purged roles from ${PURGE_AMOUNT} member${PURGE_AMOUNT !== 1 ? 's' : ''}`,
			);
		} finally {
			PurgeRolesCommand.running.delete(discordGuild.id);
		}
	}
}
