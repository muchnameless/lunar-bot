import { SlashCommandBuilder } from '@discordjs/builders';
import { setTimeout as sleep } from 'timers/promises';
import ms from 'ms';
import { GuildMemberUtil, GuildUtil, InteractionUtil } from '../../util/index.js';
import { logger } from '../../functions/index.js';
import { SlashCommand } from '../../structures/commands/SlashCommand.js';


export default class PurgeRolesCommand extends SlashCommand {
	constructor(context) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('removes all roles that the bot manages from non guild members'),
			cooldown: 0,
		});
	}

	static running = false;

	/**
	 * time to wait between role API requests
	 */
	static TIMEOUT = 30_000;

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async runSlash(interaction) {
		if (PurgeRolesCommand.running) return await InteractionUtil.reply(interaction, {
			content: 'the command is already running',
			ephemeral: true,
		});

		try {
			PurgeRolesCommand.running = true;

			InteractionUtil.deferReply(interaction);

			const { lgGuild } = this.client;
			const GUILD_ROLE_ID = this.config.get('GUILD_ROLE_ID');
			const toPurge = [];

			for (const member of (await GuildUtil.fetchAllMembers(lgGuild)).values()) {
				if (member.roles.cache.has(GUILD_ROLE_ID)) continue;

				const rolesToPurge = GuildMemberUtil.getRolesToPurge(member);

				if (!rolesToPurge.length) continue;

				toPurge.push({
					id: member.id,
					rolesToPurge,
				});
			}

			const PURGE_AMOUNT = toPurge.length;

			if (!PURGE_AMOUNT) return await InteractionUtil.reply(interaction, 'no roles need to be purged');

			await InteractionUtil.awaitConfirmation(interaction, `purge roles from ${PURGE_AMOUNT} member${PURGE_AMOUNT !== 1 ? 's' : ''}, expected duration: ${ms((PURGE_AMOUNT - 1) * PurgeRolesCommand.TIMEOUT, { long: true })}?`);

			await Promise.all(toPurge.map(async ({ id, rolesToPurge }, index) => {
				await sleep(index * PurgeRolesCommand.TIMEOUT);

				try {
					const member = lgGuild.members.cache.get(id);
					if (!member || member.deleted) return;

					await member.roles.remove(rolesToPurge);

					logger.info(`[PURGE ROLES]: removed ${rolesToPurge.length} role(s) from ${member.user.tag} | ${member.displayName}`);
				} catch (error) {
					logger.error('[PURGE ROLES]', error);
				}
			}));

			return await InteractionUtil.reply(interaction, `done, purged roles from ${PURGE_AMOUNT} member${PURGE_AMOUNT !== 1 ? 's' : ''}`);
		} finally {
			PurgeRolesCommand.running = false;
		}
	}
}
