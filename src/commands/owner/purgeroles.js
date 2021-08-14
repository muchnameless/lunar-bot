import { setTimeout as sleep } from 'timers/promises';
import ms from 'ms';
import { GuildMemberUtil } from '../../util/GuildMemberUtil.js';
import { SlashCommand } from '../../structures/commands/SlashCommand.js';
import { logger } from '../../functions/logger.js';


export default class PurgeRolesCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'removes all roles that the bot manages from non guild members',
			options: [],
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
	async run(interaction) {
		if (PurgeRolesCommand.running) return await this.reply(interaction, {
			content: 'the command is already running',
			ephemeral: true,
		});

		try {
			PurgeRolesCommand.running = true;

			this.deferReply(interaction);

			const GUILD_ROLE_ID = this.config.get('GUILD_ROLE_ID');
			const toPurge = [];

			for (const member of (await this.client.fetchAllGuildMembers()).values()) {
				if (member.roles.cache.has(GUILD_ROLE_ID)) continue;

				const rolesToPurge = GuildMemberUtil.getRolesToPurge(member);

				if (!rolesToPurge.length) continue;

				toPurge.push({
					id: member.id,
					rolesToPurge,
				});
			}

			const PURGE_AMOUNT = toPurge.length;

			if (!PURGE_AMOUNT) return await this.reply(interaction, 'no roles need to be purged');

			await this.awaitConfirmation(interaction, `purge roles from ${PURGE_AMOUNT} member${PURGE_AMOUNT !== 1 ? 's' : ''}, expected duration: ${ms((PURGE_AMOUNT - 1) * PurgeRolesCommand.TIMEOUT, { long: true })}?`);

			const { lgGuild } = this.client;

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

			return await this.reply(interaction, `done, purged roles from ${PURGE_AMOUNT} member${PURGE_AMOUNT !== 1 ? 's' : ''}`);
		} finally {
			PurgeRolesCommand.running = false;
		}
	}
}
