'use strict';

const ms = require('ms');
const { safePromiseAll } = require('../../functions/util');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class PurgeRolesCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [],
			description: 'removes all roles that the bot manages from non guild members',
			args: false,
			usage: '',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		const { lgGuild } = this.client;

		if (!lgGuild) return message.reply('discord server is currently unavailable');
		if (lgGuild.members.cache.size !== lgGuild.memberCount) await lgGuild.members.fetch();

		let index = -1;

		const TIMEOUT = 30_000;
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
							logger.error(`[PURGE ROLES]: ${error}`);
						} finally {
							resolve();
						}
					}, ++index * TIMEOUT);
				});
			});
		const PURGE_AMOUNT = toPurge.length;

		if (!PURGE_AMOUNT) return message.reply('no roles need to be purged.');

		await safePromiseAll([
			message.reply(`purging roles from ${PURGE_AMOUNT} member${PURGE_AMOUNT !== 1 ? 's' : ''}, expected duration: ${ms((PURGE_AMOUNT - 1) * TIMEOUT, { long: true })}.`),
			...toPurge,
		]);

		message.reply(`done, purged roles from ${PURGE_AMOUNT} member${PURGE_AMOUNT !== 1 ? 's' : ''}.`);
	}
};
