'use strict';

const ms = require('ms');
const { safePromiseAll } = require('../../functions/util');
const SlashCommand = require('../../structures/commands/SlashCommand');
const logger = require('../../functions/logger');


module.exports = class PurgeRolesCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'removes all roles that the bot manages from non guild members',
			options: [],
			defaultPermission: true,
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
		if (PurgeRolesCommand.running) return interaction.reply({
			content: 'the command is already running',
			ephemeral: true,
		});

		try {
			PurgeRolesCommand.running = true;

			interaction.defer();

			const { lgGuild } = this.client;

			if (!lgGuild) return interaction.reply({
				content: 'discord server is currently unavailable',
				ephemeral: true,
			});

			await lgGuild.members.fetch();

			let index = -1;

			const toPurge = lgGuild.members.cache
				.array()
				.flatMap((member) => {
					if (member.roles.cache.has(this.config.get('GUILD_ROLE_ID'))) return [];

					/** @type {string[]} */
					const { rolesToPurge } = member;

					if (!rolesToPurge.length) return [];

					return new Promise((resolve) => {
						this.client.setTimeout(async () => {
							try {
								if (member.deleted) return;
								await member.roles.remove(rolesToPurge);
								logger.info(`[PURGE ROLES]: removed ${rolesToPurge.length} role(s) from ${member.user.tag} | ${member.displayName}`);
							} catch (error) {
								logger.error('[PURGE ROLES]', error);
							} finally {
								resolve();
							}
						}, ++index * PurgeRolesCommand.TIMEOUT);
					});
				});
			const PURGE_AMOUNT = toPurge.length;

			if (!PURGE_AMOUNT) return interaction.reply('no roles need to be purged');

			await safePromiseAll([
				interaction.reply(`purging roles from ${PURGE_AMOUNT} member${PURGE_AMOUNT !== 1 ? 's' : ''}, expected duration: ${ms((PURGE_AMOUNT - 1) * PurgeRolesCommand.TIMEOUT, { long: true })}`),
				...toPurge,
			]);

			return interaction.reply(`done, purged roles from ${PURGE_AMOUNT} member${PURGE_AMOUNT !== 1 ? 's' : ''}`);
		} finally {
			PurgeRolesCommand.running = false;
		}
	}
};
