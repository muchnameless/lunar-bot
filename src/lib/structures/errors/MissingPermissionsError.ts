import { InteractionUtil } from '#utils';
import { commaListOr } from '#functions';
import type { Interaction, Guild, Snowflake } from 'discord.js';

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
	requiredRoleIds?: Iterable<Snowflake> | null,
) => {
	const requiredRoles: string[] = [];

	if (requiredRoleIds) {
		for (const roleId of requiredRoleIds) {
			const role = guild?.roles.cache.get(roleId);

			if (role) {
				requiredRoles.push(interaction.guildId === guild!.id ? `${role}` : role.name);
			} else {
				requiredRoles.push(roleId);
			}
		}
	}

	return `missing permissions for \`${InteractionUtil.fullCommandName(interaction)}\` (${
		requiredRoles.length
			? commaListOr(requiredRoles)
			: `no roles set up for ${guild?.name ?? 'uncached discord server'}`
	}): ${message}`;
};
