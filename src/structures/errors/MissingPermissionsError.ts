import { commaListsOr } from 'common-tags';
import { InteractionUtil } from '../../util';
import type { Guild, Interaction, Snowflake } from 'discord.js';

/**
 * @param message
 * @param interaction
 * @param guild
 * @param requiredRolesRaw
 */
export const missingPermissionsError = (
	message: string,
	interaction: Interaction,
	guild: Guild | null,
	requiredRolesRaw: Snowflake[],
) => {
	const requiredRoles = requiredRolesRaw.flatMap((roleId) => {
		if (!roleId) return [];

		const role = guild?.roles.cache.get(roleId);
		if (!role) return roleId;

		return interaction.guildId === guild!.id ? `${role}` : role.name;
	});

	return commaListsOr`missing permissions for \`${InteractionUtil.fullCommandName(interaction)}\` (${
		requiredRoles.length ? requiredRoles : `no roles set up for ${guild?.name ?? 'uncached discord server'}`
	}): ${message}`;
};
