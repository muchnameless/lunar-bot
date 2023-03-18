import type { Interaction, Guild, Snowflake } from 'discord.js';
import { commaListOr } from '#functions';
import { InteractionUtil } from '#utils';

/**
 * @param message
 * @param interaction
 * @param guild
 * @param requiredRoleIds
 */
export const missingPermissionsError = (
	message: string,
	interaction: Interaction,
	guild: Guild | null,
	requiredRoleIds?: Snowflake[] | null,
) => {
	const requiredRoles = requiredRoleIds?.map((roleId) => {
		const role = guild?.roles.cache.get(roleId);
		if (!role) return roleId;

		return interaction.guildId === guild!.id ? `${role}` : role.name;
	});

	return `missing permissions for \`${InteractionUtil.fullCommandName(interaction)}\` (${
		requiredRoles?.length
			? commaListOr(requiredRoles)
			: `no roles set up for ${guild?.name ?? 'uncached discord server'}`
	}): ${message}`;
};
