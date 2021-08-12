'use strict';

const { commaListsOr } = require('common-tags');


/**
 * @param {string} message
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('discord.js').Snowflake[]} requiredRolesRaw
 */
module.exports = (message, { client, guildId, fullCommandName }, requiredRolesRaw) => commaListsOr`
	missing permissions for \`${fullCommandName}\` (${
		requiredRolesRaw.flatMap((roleId) => {
			if (!roleId) return [];

			const role = client.lgGuild?.roles.cache.get(roleId);
			if (!role) return roleId;

			return guildId === client.config.get('DISCORD_GUILD_ID')
				? `${role}`
				: role.name;
		})
	}): ${message}
`;
