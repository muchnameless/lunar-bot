import { Permissions, Role } from 'discord.js';
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
import { UserUtil } from '.';
import { logger } from '../functions';
import type { Collection, GuildMember, MessageOptions, Snowflake } from 'discord.js';
import type { Player } from '../structures/database/models/Player';
import type { LunarClient } from '../structures/LunarClient';


type RoleCollection = Collection<Snowflake, Role>;


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
		for (const { ranks, roleId } of hypixelGuilds.cache.values()) {
			if (!roleId) continue;

			for (const { roleId: rankRoleId } of ranks) {
				if (rankRoleId && member.roles.cache.has(rankRoleId)) rolesToRemove.push(rankRoleId);
			}

			if (member.roles.cache.has(roleId)) rolesToRemove.push(roleId);
		}

		if (member.roles.cache.has(config.get('GUILD_ROLE_ID'))) rolesToRemove.push(config.get('GUILD_ROLE_ID'));
		if (member.roles.cache.has(config.get('WHALECUM_PASS_ROLE_ID'))) rolesToRemove.push(config.get('WHALECUM_PASS_ROLE_ID'));

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
	static async setRoles(member: GuildMember, roles: RoleCollection) {
		const { me } = member.guild;
		if (!me?.permissions.has(Permissions.FLAGS.MANAGE_ROLES)) return logger.warn('[SET ROLES]: missing \'MANAGE_ROLES\'');

		const { highest } = me.roles;
		const difference = roles.difference(member.roles.cache);
		if (!difference.size) return logger.warn('[SET ROLES]: nothing to change');
		if (difference.some(role => role.managed || Role.comparePositions(role, highest) >= 0)) {
			return logger.warn(`[SET ROLES]: unable to add / remove '@${difference.find(role => role.managed || Role.comparePositions(highest, role) <= 0)!.name}'`);
		}

		try {
			return await member.roles.set(roles);
		} catch (error) {
			return logger.error(error);
		}
	}

	/**
	 * add / remove roles from a GuildMember
	 * @param member
	 * @param options
	 */
	static editRoles(member: GuildMember, { add, remove }: { add?: RoleCollection, remove?: RoleCollection}) {
		let roles = member.roles.cache;
		if (remove) roles = roles.filter((_, id) => !remove.has(id));
		if (add) roles = roles.concat(add); // eslint-disable-line unicorn/prefer-spread

		return this.setRoles(member, roles);
	}

	/**
	 * @param member
	 * @param contentOrOptions
	 */
	static sendDM(member: GuildMember, contentOrOptions: string | MessageOptions) {
		return UserUtil.sendDM(member.user, contentOrOptions);
	}
}
