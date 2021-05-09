'use strict';

const { Structures, Guild, Collection } = require('discord.js');
const logger = require('../../functions/logger');


class LunarGuild extends Guild {
	constructor(...args) {
		super(...args);

		/**
		 * @type {Collection<string, import('./GuildMember')}
		 */
		this.members.cache;
	}

	/**
	 * verifies the roles via guild.roles.cache and sorts them by position, array -> collection
	 * @param {string[]} roleIDs role IDs to verify
	 */
	verifyRoleIDs(roleIDs) {
		const highestBotRole = this.me.roles.highest;

		return new Collection(
			roleIDs
				.map(roleID => [ roleID, this.roles.cache.get(roleID) ])
				.filter(([ roleID, role ]) => {
					if (!role) return logger.warn(`[CHECK ROLE IDS]: '${roleID}' is not a valid role id`);
					if (role.managed) return logger.warn(`[CHECK ROLE IDS]: '${roleID}' is a managed role`);
					if (role.comparePositionTo(highestBotRole) >= 0) return logger.warn(`[CHECK ROLE IDS]: '${role.name}' is higher than the bot's highest role`);
					return true;
				})
				.sort(([ , a ], [ , b ]) => b.comparePositionTo(a)),
		);
	}

	/**
	 * tries to find a discord member by a discord tag
	 * @param {string} tagInput
	 */
	async findMemberByTag(tagInput) {
		const discordMember = this.members.cache.find(({ user: { tag } }) => tag === tagInput);

		if (discordMember) return discordMember;

		const fetched = await this.members.search({ query: tagInput.split('#')[0], limit: 10 }).catch(error => logger.error(`[UPDATE GUILD PLAYERS]: ${error}`));
		// const fetched = await this.members.fetch({ query: tagInput.split('#')[0] }).catch(error => logger.error(`[UPDATE GUILD PLAYERS]: ${error}`));

		return fetched?.find(({ user: { tag } }) => tag === tagInput) ?? null;
	}
}

Structures.extend('Guild', () => LunarGuild);

module.exports = LunarGuild;
