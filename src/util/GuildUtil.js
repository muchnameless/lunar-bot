'use strict';

const { Collection } = require('discord.js');
const logger = require('../functions/logger');


module.exports = class GuildUtil extends null {
	/**
	 * verifies the roles via guild.roles.cache and sorts them by position, array -> collection
	 * @param {import('discord.js').Guild} guild
	 * @param {(?(import('discord.js').Snowflake | import('discord.js').Role))[] | import('discord.js').Collection<import('discord.js').Snowflake, import('discord.js').Role>} rolesOrIds roles or role IDs to verify
	 * @returns {Collection<import('discord.js').Snowflake, import('discord.js').Role>}
	 */
	static resolveRoles(guild, rolesOrIds) {
		return new Collection(
			rolesOrIds
				.map((roleOrId) => {
					const role = guild.roles.resolve(roleOrId);
					return [ role?.id ?? roleOrId, role ];
				})
				.filter(([ roleId, role ]) => {
					if (!role) return logger.warn(`[CHECK ROLE IDS]: '${roleId}' is not a valid role id`);
					if (!role.editable) return logger.warn(`[CHECK ROLE IDS]: can't edit '${role.name}'`);
					return true;
				})
				.sort(([ , a ], [ , b ]) => b.comparePositionTo(a)),
		);
	}

	/**
	 * tries to find a discord member by a discord tag
	 * @param {import('discord.js').Guild} guild
	 * @param {string} tagInput
	 */
	static async fetchMemberByTag(guild, tagInput) {
		if (guild.members.cache.size === guild.memberCount) return guild.members.cache.find(({ user: { tag } }) => tag === tagInput) ?? null;

		try {
			return (await guild.members.fetch({ query: tagInput.replace(/#\d{4}$/, ''), limit: 1_000 })).find(({ user: { tag } }) => tag === tagInput) ?? null;
		} catch (error) {
			logger.error('[FIND MEMBER BY TAG]', error);
			return null;
		}
	}
};
