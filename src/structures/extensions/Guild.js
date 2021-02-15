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
					if (role.comparePositionTo(highestBotRole) >= 0) return logger.warn(`[CHECK ROLE IDS]: '${role.name}' is higher than the bot's highest role`);
					return true;
				})
				.sort(([, a ], [, b ]) => b.comparePositionTo(a)),
		);
	}

	/**
	 * tries to find a discord member by a discord tag
	 * @param {string} tag
	 */
	async findMemberByTag(tag) {
		const discordMember = this.members.cache.find(member => member.user.tag === tag);

		if (discordMember) return discordMember;

		const fetched = await this.members.fetch({ query: tag.split('#')[0] }).catch(error => logger.error(`[UPDATE GUILD PLAYERS]: ${error.name}: ${error.message}`));

		return fetched?.find(member => member.user.tag === tag) ?? null;
	}
}

Structures.extend('Guild', Guild => LunarGuild); // eslint-disable-line no-shadow, no-unused-vars

module.exports = LunarGuild;
