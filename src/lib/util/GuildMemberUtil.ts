import { ModerationLimits } from '@sapphire/discord-utilities';
import {
	Collection,
	PermissionFlagsBits,
	type GuildMember,
	type Message,
	type Snowflake,
	type Role,
	type PartialGuildMember,
} from 'discord.js';
import { GuildUtil, UserUtil, type RoleCollection, type RoleResolvables, type SendDMOptions } from './index.js';
import {
	CATACOMBS_ROLES,
	DELIMITER_ROLES,
	SKILL_AVERAGE_ROLES,
	SKILL_ROLES,
	SKILLS,
	SLAYER_ROLES,
	SLAYER_TOTAL_ROLES,
	SLAYERS,
} from '#constants';
import { seconds } from '#functions';
import { logger } from '#logger';
import type { Player } from '#structures/database/models/Player.js';
import { toUpperCase } from '#types';

export class GuildMemberUtil extends null {
	/**
	 * @param member
	 */
	public static logInfo(member: GuildMember | PartialGuildMember) {
		return {
			user: UserUtil.logInfo(member.user),
			guild: GuildUtil.logInfo(member.guild),
			nickname: member.nickname,
			// @ts-expect-error private
			roles: member._roles,
		};
	}

	/**
	 * @param member
	 */
	public static getPlayer(member: GuildMember | PartialGuildMember | null | undefined) {
		return UserUtil.getPlayer(member?.user);
	}

	/**
	 * @param member
	 * @param player
	 */
	public static setPlayer(member: GuildMember, player: Player | null) {
		return UserUtil.setPlayer(member.user, player);
	}

	/**
	 * returns an array with the member's roles that the bot manages
	 *
	 * @param member
	 */
	public static getRolesToPurge(member: GuildMember) {
		const { cache: roleCache } = member.roles;
		const rolesToRemove: Snowflake[] = [];
		const discordGuild = member.client.discordGuilds.cache.get(member.guild.id);

		if (discordGuild) {
			for (const hypixelGuildId of discordGuild.hypixelGuildIds) {
				const hypixelGuild = member.client.hypixelGuilds.cache.get(hypixelGuildId);
				if (!hypixelGuild) continue;

				// guild
				if (roleCache.has(hypixelGuild.GUILD_ROLE_ID!)) rolesToRemove.push(hypixelGuild.GUILD_ROLE_ID!);

				for (const { roleId: rankRoleId } of hypixelGuild.ranks) {
					if (roleCache.has(rankRoleId!)) rolesToRemove.push(rankRoleId!);
				}
			}

			for (const role of ['GUILD', 'INACTIVE'] as const) {
				if (roleCache.has(discordGuild[`${role}_ROLE_ID`]!)) rolesToRemove.push(discordGuild[`${role}_ROLE_ID`]!);
			}

			// delimiter
			for (const type of DELIMITER_ROLES) {
				if (roleCache.has(discordGuild[`${type}_DELIMITER_ROLE_ID`]!)) {
					rolesToRemove.push(discordGuild[`${type}_DELIMITER_ROLE_ID`]!);
				}
			}

			// skill average
			for (const level of SKILL_AVERAGE_ROLES) {
				if (roleCache.has(discordGuild[`AVERAGE_LVL_${level}_ROLE_ID`]!)) {
					rolesToRemove.push(discordGuild[`AVERAGE_LVL_${level}_ROLE_ID`]!);
				}
			}

			// individual skills
			for (const skill of SKILLS.map((skill) => toUpperCase(skill))) {
				for (const level of SKILL_ROLES) {
					if (roleCache.has(discordGuild[`${skill}_${level}_ROLE_ID`]!)) {
						rolesToRemove.push(discordGuild[`${skill}_${level}_ROLE_ID`]!);
					}
				}
			}

			// total slayer
			for (const level of SLAYER_TOTAL_ROLES) {
				if (roleCache.has(discordGuild[`SLAYER_ALL_${level}_ROLE_ID`]!)) {
					rolesToRemove.push(discordGuild[`SLAYER_ALL_${level}_ROLE_ID`]!);
				}
			}

			// individual slayer
			for (const slayer of SLAYERS.map((slayer) => toUpperCase(slayer))) {
				for (const level of SLAYER_ROLES) {
					if (roleCache.has(discordGuild[`${slayer}_${level}_ROLE_ID`]!)) {
						rolesToRemove.push(discordGuild[`${slayer}_${level}_ROLE_ID`]!);
					}
				}
			}

			// catacombs
			for (const level of CATACOMBS_ROLES) {
				if (roleCache.has(discordGuild[`CATACOMBS_${level}_ROLE_ID`]!)) {
					rolesToRemove.push(discordGuild[`CATACOMBS_${level}_ROLE_ID`]!);
				}
			}

			// weight
			if (discordGuild.weightRoleIds) {
				for (const { roleId } of discordGuild.weightRoleIds) {
					if (roleCache.has(roleId)) rolesToRemove.push(roleId);
				}
			}
		}

		return rolesToRemove;
	}

	/**
	 * sets a GuildMember's roles, performing permission checks beforehand
	 *
	 * @param member
	 * @param roles
	 */
	public static async setRoles(member: GuildMember, roles: RoleResolvables) {
		const difference: RoleCollection = (
			Array.isArray(roles)
				? (() => {
						const resolvedRoles = new Collection<Snowflake, Role>();
						for (const roleOrId of roles) {
							if (!roleOrId) continue;
							const role = member.guild.roles.resolve(roleOrId);
							if (role) resolvedRoles.set(role.id, role);
						}

						return resolvedRoles;
				  })()
				: roles
		).difference(member.roles.cache);
		if (!difference.size) {
			logger.warn({ member: this.logInfo(member), data: roles }, '[GUILDMEMBER SET ROLES]: nothing to change');
			return member;
		}

		const me = member.guild.members.me!;
		if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
			logger.warn(
				{ member: this.logInfo(member), data: roles },
				"[GUILDMEMBER SET ROLES]: missing 'MANAGE_ROLES' permission",
			);
			return member;
		}

		const { highest } = me.roles;
		if (difference.some((role) => role.managed || member.guild.roles.comparePositions(role, highest) >= 0)) {
			logger.warn(
				{
					member: this.logInfo(member),
					data: roles,
					filtered: difference.filter(
						(role) => role.managed || member.guild.roles.comparePositions(role, highest) >= 0,
					),
				},
				'[GUILDMEMBER SET ROLES]: missing permissions to add / remove',
			);
			return member;
		}

		try {
			return await member.roles.set(
				Array.isArray(roles) ? roles.filter((x): x is NonNullable<typeof x> => x !== null) : roles,
			);
		} catch (error) {
			logger.error({ member: this.logInfo(member), err: error, data: roles }, '[GUILDMEMBER SET ROLES]');
			return member;
		}
	}

	/**
	 * add / remove roles from a GuildMember
	 *
	 * @param member
	 * @param options
	 */
	public static async editRoles(
		member: GuildMember,
		{ add = [], remove = [] }: { add?: RoleResolvables; remove?: RoleResolvables },
	) {
		const rolesToRemove = GuildUtil.resolveRoles(member.guild, remove);
		let rolesToAdd = GuildUtil.resolveRoles(member.guild, add);

		if (rolesToAdd === null && rolesToRemove === null) return member;

		rolesToAdd ??= [];

		for (const role of member.roles.cache.values()) {
			if (rolesToRemove?.some(({ id }) => id === role.id)) continue;
			rolesToAdd.push(role);
		}

		try {
			return await member.roles.set(rolesToAdd);
		} catch (error) {
			logger.error({ member: this.logInfo(member), err: error, data: { add, remove } }, '[GUILDMEMBER EDIT ROLES]');
			return member;
		}
	}

	/**
	 * @param member
	 * @param options
	 */
	public static sendDM(member: GuildMember, options: SendDMOptions & { rejectOnError: true }): Promise<Message>;
	public static sendDM(member: GuildMember, options: SendDMOptions | string): Promise<Message | null>;
	public static async sendDM(member: GuildMember, options: SendDMOptions | string) {
		return UserUtil.sendDM(member.user, options);
	}

	/**
	 * @param member
	 * @param duration
	 * @param reason
	 */
	public static async timeout(member: GuildMember, duration: number | null, reason?: string) {
		if (!member.moderatable) {
			logger.warn(
				{ member: this.logInfo(member), data: { duration, reason } },
				'[GUILDMEMBER TIMEOUT]: missing permissions',
			);
			return member;
		}

		const DURATION = duration === null ? null : Math.min(duration, ModerationLimits.MaximumTimeoutDuration);

		if (Math.abs(member.communicationDisabledUntilTimestamp! - Date.now() - DURATION!) < seconds(1)) {
			logger.debug(
				{ member: this.logInfo(member), data: { duration, reason } },
				'[GUILDMEMBER TIMEOUT]: is already in (similar) timeout',
			);
			return member;
		}

		try {
			return await member.timeout(DURATION, reason);
		} catch (error) {
			logger.error({ member: this.logInfo(member), err: error, data: { duration, reason } }, '[GUILDMEMBER TIMEOUT]');
			return member;
		}
	}
}
