import { InteractionUtil } from '#utils';
import { commaListOr } from '#functions';
import type { Interaction, Guild, Snowflake } from 'discord.js';

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
	const requiredRoles = requiredRolesRaw.map((roleId) => {
		const role = guild?.roles.cache.get(roleId);
		if (!role) return roleId;

		return interaction.guildId === guild!.id ? `${role}` : role.name;
	});

	return `missing permissions for \`${InteractionUtil.fullCommandName(interaction)}\` (${
		requiredRoles.length
			? commaListOr(requiredRoles)
			: `no roles set up for ${guild?.name ?? 'uncached discord server'}`
	}): ${message}`;
};
