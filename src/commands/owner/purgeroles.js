'use strict';

const { setTimeout: sleep } = require('timers/promises');
const ms = require('ms');
const SlashCommand = require('../../structures/commands/SlashCommand');
const logger = require('../../functions/logger');


module.exports = class PurgeRolesCommand extends SlashCommand {
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
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		if (PurgeRolesCommand.running) return await interaction.reply({
			content: 'the command is already running',
			ephemeral: true,
		});

		try {
			PurgeRolesCommand.running = true;

			interaction.deferReply();

			const GUILD_ROLE_ID = this.config.get('GUILD_ROLE_ID');
			const toPurge = [];

			for (const member of (await this.client.fetchAllGuildMembers()).values()) {
				if (member.roles.cache.has(GUILD_ROLE_ID)) continue;

				const { rolesToPurge } = member;

				if (!rolesToPurge.length) continue;

				toPurge.push({
					id: member.id,
					rolesToPurge,
				});
			}

			const PURGE_AMOUNT = toPurge.length;

			if (!PURGE_AMOUNT) return await interaction.reply('no roles need to be purged');

			await interaction.awaitConfirmation(`purge roles from ${PURGE_AMOUNT} member${PURGE_AMOUNT !== 1 ? 's' : ''}, expected duration: ${ms((PURGE_AMOUNT - 1) * PurgeRolesCommand.TIMEOUT, { long: true })}?`);

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

			return await interaction.reply(`done, purged roles from ${PURGE_AMOUNT} member${PURGE_AMOUNT !== 1 ? 's' : ''}`);
		} finally {
			PurgeRolesCommand.running = false;
		}
	}
};
