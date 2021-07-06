'use strict';

const { commaListsOr } = require('common-tags');


/**
 * @param {string} message
 * @param {import('../extensions/CommandInteraction')} interaction
 * @param {import('discord.js').Snowflake[]} requiredRolesRaw
 */
module.exports = (message, { client, guildId, fullCommandName }, requiredRolesRaw) => commaListsOr`
	missing permissions for \`${fullCommandName}\` (${
		requiredRolesRaw.map((roleId) => {
			const role = client.lgGuild?.roles.cache.get(roleId);
			if (!role) return roleId;
			return guildId === client.config.get('MAIN_GUILD_ID')
				? `${role}`
				: role.name;
		})
	}): ${message}
`;
