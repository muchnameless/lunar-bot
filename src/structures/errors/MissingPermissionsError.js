'use strict';

const { commaListsOr } = require('common-tags');


/**
 * @param {string} message
 * @param {import('../extensions/CommandInteraction')} interaction
 * @param {import('discord.js').Snowflake[]} requiredRolesRaw
 */
module.exports = (message, { client, guildID, fullCommandName }, requiredRolesRaw) => commaListsOr`
	missing permissions for \`${fullCommandName}\` (${
		requiredRolesRaw.map((roleID) => {
			const role = client.lgGuild?.roles.cache.get(roleID);
			if (!role) return roleID;
			return guildID === client.config.get('MAIN_GUILD_ID')
				? `${role}`
				: role.name;
		})
	}): ${message}
`;
