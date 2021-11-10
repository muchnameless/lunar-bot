import { commaListsOr } from 'common-tags';
import { InteractionUtil } from '../../util';
import type { Interaction, Snowflake } from 'discord.js';
import type { LunarClient } from '../LunarClient';

/**
 * @param message
 * @param interaction
 * @param requiredRolesRaw
 */
export const missingPermissionsError = (
	message: string,
	interaction: Interaction,
	requiredRolesRaw: Snowflake[],
) => commaListsOr`
	missing permissions for \`${InteractionUtil.fullCommandName(interaction)}\` (${requiredRolesRaw.flatMap((roleId) => {
	if (!roleId) return [];

	const role = (interaction.client as LunarClient).lgGuild?.roles.cache.get(roleId);
	if (!role) return roleId;

	return interaction.guildId === (interaction.client as LunarClient).config.get('DISCORD_GUILD_ID')
		? `${role}`
		: role.name;
})}): ${message}
`;
