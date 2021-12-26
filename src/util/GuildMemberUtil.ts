import { Collection, Permissions } from 'discord.js';
import { commaListsAnd } from 'common-tags';
import {
	CATACOMBS_ROLES,
	DELIMITER_ROLES,
	MAX_TIMEOUT_DURATION,
	SKILL_AVERAGE_ROLES,
	SKILL_ROLES,
	SKILLS,
	SLAYER_ROLES,
	SLAYER_TOTAL_ROLES,
	SLAYERS,
} from '../constants';
import { logger, seconds } from '../functions';
import { GuildUtil, UserUtil } from '.';
import type { GuildMember, Message, MessageOptions, Snowflake, Role } from 'discord.js';
import type { Player } from '../structures/database/models/Player';
import type { LunarClient } from '../structures/LunarClient';
import type { RoleCollection, RoleResolvables } from './GuildUtil';

export default class GuildMemberUtil extends null {
	/**
	 * @param member
	 */
	static logInfo(member: GuildMember) {
		if (member.nickname) return `${member.nickname} | ${member.user.tag}`;
		return member.user.tag;
	}

	/**
	 * @param member
	 */
	static getPlayer(member: GuildMember | null | undefined) {
		return UserUtil.getPlayer(member?.user);
	}

	/**
	 * @param member
	 * @param player
	 */
	static setPlayer(member: GuildMember, player: Player | null) {
		return UserUtil.setPlayer(member.user, player);
	}

	/**
	 * returns an array with the member's roles that the bot manages
	 * @param member
	 */
	static getRolesToPurge(member: GuildMember) {
		const { cache: roleCache } = member.roles;
		const rolesToRemove: Snowflake[] = [];
		const discordGuild = (member.client as LunarClient).discordGuilds.cache.get(member.guild.id);

		if (discordGuild) {
			for (const hypixelGuildId of discordGuild.hypixelGuildIds) {
				const hypixelGuild = (member.client as LunarClient).hypixelGuilds.cache.get(hypixelGuildId);
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
			for (const skill of SKILLS.map((s) => s.toUpperCase() as Uppercase<typeof s>)) {
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
			for (const slayer of SLAYERS.map((s) => s.toUpperCase() as Uppercase<typeof s>)) {
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
	 * @param member
	 * @param roles
	 */
	static async setRoles(member: GuildMember, roles: RoleResolvables) {
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
			logger.warn(`[SET ROLES] ${this.logInfo(member)}: nothing to change`);
			return member;
		}

		const { me } = member.guild;
		if (!me!.permissions.has(Permissions.FLAGS.MANAGE_ROLES)) {
			logger.warn(`[SET ROLES] ${this.logInfo(member)}: missing 'MANAGE_ROLES' permission`);
			return member;
		}

		const { highest } = me!.roles;
		if (difference.some((role) => role.managed || member.guild.roles.comparePositions(role, highest) >= 0)) {
			logger.warn(
				commaListsAnd`[SET ROLES] ${this.logInfo(member)}: unable to add / remove '${difference
					.filter((role) => role.managed || member.guild.roles.comparePositions(role, highest) >= 0)
					.map(({ name }) => `@${name}`)}'
				`,
			);
			return member;
		}

		try {
			return await member.roles.set(Array.isArray(roles) ? (roles.filter(Boolean) as (Snowflake | Role)[]) : roles);
		} catch (error) {
			logger.error(error);
			return member;
		}
	}

	/**
	 * add / remove roles from a GuildMember
	 * @param member
	 * @param options
	 */
	static async editRoles(
		member: GuildMember,
		{ add = [], remove = [] }: { add?: RoleResolvables; remove?: RoleResolvables },
	) {
		const rolesToAdd = GuildUtil.resolveRoles(member.guild, add);
		const rolesToRemove = GuildUtil.resolveRoles(member.guild, remove);

		if (!rolesToAdd.length || !rolesToRemove.length) return member;

		for (const role of member.roles.cache.values()) {
			if (rolesToRemove.some(({ id }) => id === role.id)) continue;
			rolesToAdd.push(role);
		}

		try {
			return await member.roles.set(rolesToAdd);
		} catch (error) {
			logger.error(error);
			return member;
		}
	}

	/**
	 * @param member
	 * @param options
	 */
	static sendDM(member: GuildMember, options: MessageOptions & { rejectOnError: true }): Promise<Message>;
	static sendDM(
		member: GuildMember,
		options: string | (MessageOptions & { rejectOnError?: boolean }),
	): Promise<Message | null>;
	static sendDM(member: GuildMember, options: string | MessageOptions) {
		return UserUtil.sendDM(member.user, options);
	}

	/**
	 * @param member
	 * @param duration
	 * @param reason
	 */
	static async timeout(member: GuildMember, duration: number | null, reason?: string) {
		if (!member.moderatable) {
			logger.warn(`[TIMEOUT] ${this.logInfo(member)}: missing permissions`);
			return member;
		}

		const DURATION = duration !== null ? Math.min(duration, MAX_TIMEOUT_DURATION) : null;

		if (Math.abs(member.communicationDisabledUntilTimestamp! - Date.now() - DURATION!) < seconds(1)) {
			logger.trace(`[TIMEOUT] ${this.logInfo(member)}: is already in (similar) timeout`);
			return member;
		}

		try {
			return await member.timeout(DURATION, reason);
		} catch (error) {
			logger.error(error, `[TIMEOUT] ${this.logInfo(member)}`);
			return member;
		}
	}
}
