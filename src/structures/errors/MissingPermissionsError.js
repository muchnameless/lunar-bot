'use strict';

const { commaListsOr } = require('common-tags');
const InteractionUtil = require('../../util/InteractionUtil');


/**
 * @param {string} message
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('discord.js').Snowflake[]} requiredRolesRaw
 */
module.exports = (message, interaction, requiredRolesRaw) => commaListsOr`
	missing permissions for \`${InteractionUtil.fullCommandName(interaction)}\` (${
		requiredRolesRaw.flatMap((roleId) => {
			if (!roleId) return [];

			const role = interaction.client.lgGuild?.roles.cache.get(roleId);
			if (!role) return roleId;

			return interaction.guildId === interaction.client.config.get('DISCORD_GUILD_ID')
				? `${role}`
				: role.name;
		})
	}): ${message}
`;
