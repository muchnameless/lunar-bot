import { Collection, Permissions, Role } from 'discord.js';
import { commaListsAnd } from 'common-tags';
import {
	CATACOMBS_ROLES,
	DELIMITER_ROLES,
	SKILL_AVERAGE_ROLES,
	SKILL_ROLES,
	SKILLS,
	SLAYER_ROLES,
	SLAYER_TOTAL_ROLES,
	SLAYERS,
} from '../constants';
import { GuildUtil, UserUtil } from '.';
import { logger } from '../functions';
import type { GuildMember, MessageOptions, Snowflake } from 'discord.js';
import type { Player } from '../structures/database/models/Player';
import type { LunarClient } from '../structures/LunarClient';
import type { RoleCollection, RoleResolvables } from './GuildUtil';


export default class GuildMemberUtil extends null {
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
		const { config,	hypixelGuilds } = member.client as LunarClient;
		const rolesToRemove: Snowflake[] = [];

		// guild
		for (const { roleId, ranks } of hypixelGuilds.cache.values()) {
			if (roleId && member.roles.cache.has(roleId)) rolesToRemove.push(roleId);

			for (const { roleId: rankRoleId } of ranks) {
				if (rankRoleId && member.roles.cache.has(rankRoleId)) rolesToRemove.push(rankRoleId);
			}
		}

		for (const role of [ 'GUILD_ROLE_ID', 'WHALECUM_PASS_ROLE_ID', 'INACTIVE_ROLE_ID' ] as const) {
			if (member.roles.cache.has(config.get(role))) rolesToRemove.push(config.get(role));
		}

		// delimiter
		for (const type of DELIMITER_ROLES) {
			if (member.roles.cache.has(config.get(`${type}_DELIMITER_ROLE_ID`))) rolesToRemove.push(config.get(`${type}_DELIMITER_ROLE_ID`));
		}

		// skill average
		for (const level of SKILL_AVERAGE_ROLES) {
			if (member.roles.cache.has(config.get(`AVERAGE_LVL_${level}_ROLE_ID`))) rolesToRemove.push(config.get(`AVERAGE_LVL_${level}_ROLE_ID`));
		}

		// individual skills
		for (const skill of SKILLS) {
			for (const level of SKILL_ROLES) {
				if (member.roles.cache.has(config.get(`${skill}_${level}_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_${level}_ROLE_ID`));
			}
		}

		// total slayer
		for (const level of SLAYER_TOTAL_ROLES) {
			if (member.roles.cache.has(config.get(`SLAYER_ALL_${level}_ROLE_ID`))) rolesToRemove.push(config.get(`SLAYER_ALL_${level}_ROLE_ID`));
		}

		// individual slayer
		for (const slayer of SLAYERS) {
			for (const level of SLAYER_ROLES) {
				if (member.roles.cache.has(config.get(`${slayer}_${level}_ROLE_ID`))) rolesToRemove.push(config.get(`${slayer}_${level}_ROLE_ID`));
			}
		}

		// catacombs
		for (const level of CATACOMBS_ROLES) {
			if (member.roles.cache.has(config.get(`CATACOMBS_${level}_ROLE_ID`))) rolesToRemove.push(config.get(`CATACOMBS_${level}_ROLE_ID`));
		}

		return rolesToRemove;
	}

	/**
	 * sets a GuildMember's roles, performing permission checks beforehand
	 * @param member
	 * @param roles
	 */
	static async setRoles(member: GuildMember, roles: RoleResolvables) {
		const difference: RoleCollection = (Array.isArray(roles)
			? (() => {
				const resolvedRoles = new Collection<Snowflake, Role>();
				for (const roleOrId of roles) {
					if (!roleOrId) continue;
					const role = member.guild.roles.resolve(roleOrId);
					if (role) resolvedRoles.set(role.id, role);
				}
				return resolvedRoles;
			})()
			: roles).difference(member.roles.cache);
		if (!difference.size) {
			logger.warn('[SET ROLES]: nothing to change');
			return member;
		}

		const { me } = member.guild;
		if (!me!.permissions.has(Permissions.FLAGS.MANAGE_ROLES)) {
			logger.warn('[SET ROLES]: missing \'MANAGE_ROLES\' permission');
			return member;
		}

		const { highest } = me!.roles;
		if (difference.some(role => role.managed || Role.comparePositions(role, highest) >= 0)) {
			logger.warn(commaListsAnd`[SET ROLES]: unable to add / remove '${
				difference.filter(role => role.managed || Role.comparePositions(role, highest) >= 0).map(({ name }) => `@${name}`)
			}'`);
			return member;
		}

		try {
			return await member.roles.set(Array.isArray(roles) ? roles.filter(Boolean) as (Snowflake | Role)[] : roles);
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
	static async editRoles(member: GuildMember, { add = [], remove = [] }: { add?: RoleResolvables, remove?: RoleResolvables}) {
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
	 * @param contentOrOptions
	 */
	static sendDM(member: GuildMember, contentOrOptions: string | MessageOptions) {
		return UserUtil.sendDM(member.user, contentOrOptions);
	}
}
