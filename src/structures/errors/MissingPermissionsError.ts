import { commaListsOr } from 'common-tags';
import { InteractionUtil } from '../../util';
import type { Guild, Interaction, Snowflake } from 'discord.js';

/**
 * @param message
 * @param interaction
 * @param discordGuild
 * @param requiredRolesRaw
 */
export const missingPermissionsError = (
	message: string,
	interaction: Interaction,
	discordGuild: Guild | null,
	requiredRolesRaw: Snowflake[],
) => commaListsOr`
	missing permissions for \`${InteractionUtil.fullCommandName(interaction)}\` (${requiredRolesRaw.flatMap((roleId) => {
	if (!roleId) return [];

	const role = discordGuild?.roles.cache.get(roleId);
	if (!role) return roleId;

	return interaction.guildId === discordGuild!.id ? `${role}` : role.name;
})}): ${message}
`;
