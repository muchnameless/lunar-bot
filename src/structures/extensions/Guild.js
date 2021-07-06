'use strict';

const { Structures, Collection } = require('discord.js');
const logger = require('../../functions/logger');


class LunarGuild extends Structures.get('Guild') {
	/**
	 * verifies the roles via guild.roles.cache and sorts them by position, array -> collection
	 * @param {(?import('discord.js').Snowflake)[]} roleIds role IDs to verify
	 * @returns {Collection<import('discord.js').Snowflake, import('discord.js').Role>}
	 */
	verifyRoleIds(roleIds) {
		const highestBotRole = this.me.roles.highest;

		return new Collection(
			roleIds
				.map(roleId => [ roleId, this.roles.cache.get(roleId) ])
				.filter(([ roleId, role ]) => {
					if (!role) return logger.warn(`[CHECK ROLE IDS]: '${roleId}' is not a valid role id`);
					if (role.managed) return logger.warn(`[CHECK ROLE IDS]: '${roleId}' is a managed role`);
					if (highestBotRole.comparePositionTo(role) <= 0) return logger.warn(`[CHECK ROLE IDS]: '${role.name}' is higher than the bot's highest role`);
					return true;
				})
				.sort(([ , a ], [ , b ]) => b.comparePositionTo(a)),
		);
	}

	/**
	 * tries to find a discord member by a discord tag
	 * @param {string} tagInput
	 */
	async fetchMemberByTag(tagInput) {
		if (this.members.cache.size === this.memberCount) return this.members.cache.find(({ user: { tag } }) => tag === tagInput) ?? null;

		try {
			const fetched = await this.members.fetch({ query: tagInput.replace(/#\d{4}$/, ''), limit: 1_000 });
			return fetched.find(({ user: { tag } }) => tag === tagInput) ?? null;
		} catch (error) {
			logger.error('[FIND MEMBER BY TAG]', error);
			return null;
		}
	}
}

Structures.extend('Guild', () => LunarGuild);

module.exports = LunarGuild;
