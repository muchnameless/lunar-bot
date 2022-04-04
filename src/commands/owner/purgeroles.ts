import { setTimeout as sleep } from 'node:timers/promises';
import { SlashCommandBuilder } from '@discordjs/builders';
import ms from 'ms';
import { GuildMemberUtil, GuildUtil, InteractionUtil } from '../../util';
import { seconds } from '../../functions';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
import { hypixelGuildOption } from '../../structures/commands/commonOptions';
import { logger } from '../../logger';
import type { ChatInputCommandInteraction, Snowflake } from 'discord.js';
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
	override async runSlash(interaction: ChatInputCommandInteraction) {
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
			const toPurge: { id: Snowflake; rolesToPurge: Snowflake[] }[] = [];

			for (const member of (await GuildUtil.fetchAllMembers(guild)).values()) {
				if (member.roles.cache.has(GUILD_ROLE_ID!)) continue;

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

			let success = 0;

			for (const { id, rolesToPurge } of toPurge) {
				await sleep(PurgeRolesCommand.TIMEOUT);

				const member = guild.members.cache.get(id);
				if (!member) continue;

				await member.roles.remove(rolesToPurge);

				++success;

				logger.info(
					`[PURGE ROLES]: removed ${rolesToPurge.length} role(s) from ${member.user.tag} | ${member.displayName}`,
				);
			}

			return InteractionUtil.reply(
				interaction,
				`done, purged roles from ${success}/${PURGE_AMOUNT} member${PURGE_AMOUNT !== 1 ? 's' : ''}`,
			);
		} finally {
			PurgeRolesCommand.running.delete(guild.id);
		}
	}
}
