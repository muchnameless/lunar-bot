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
} from '../constants/index.js';
import { UserUtil } from './index.js';
import { logger } from '../functions/index.js';


export default class GuildMemberUtil extends null {
	/**
	 * @param {import('discord.js').GuildMember} member
	 */
	static getPlayer(member) {
		return UserUtil.getPlayer(member?.user);
	}

	/**
	 * @param {import('discord.js').GuildMember} member
	 * @param {import('../structures/database/models/Player').Player} player
	 */
	static setPlayer(member, player) {
		return UserUtil.setPlayer(member.user, player);
	}

	/**
	 * returns an array with the member's roles that the bot manages
	 * @param {import('discord.js').GuildMember} member
	 */
	static getRolesToPurge(member) {
		const { config,	hypixelGuilds } = member.client;
		/** @type {import('discord.js').Snowflake[]} */
		const rolesToRemove = [];

		// guild
		for (const { ranks, roleId } of hypixelGuilds.cache.values()) {
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
	 * @param {import('discord.js').GuildMember} member
	 * @param {import('discord.js').Collection<import('discord.js').Snowflake, import('discord.js').Role>} roles
	 */
	static async setRoles(member, roles) {
		const { me } = member.guild;
		if (!me.permissions.has(Permissions.FLAGS.MANAGE_ROLES)) return logger.warn('[SET ROLES]: missing \'MANAGE_ROLES\'');

		const { highest } = me.roles;
		const difference = roles.difference(member.roles);
		if (!difference.size) return logger.warn('[SET ROLES]: nothing to change');
		if (difference.some(role => role.managed || Role.comparePositions(role, highest) >= 0)) {
			return logger.warn(`[SET ROLES]: unable to add / remove '@${difference.find(role => role.managed || Role.comparePositions(highest, role) <= 0).name}'`);
		}

		try {
			return await member.roles.set(roles);
		} catch (error) {
			return logger.error(error);
		}
	}

	/**
	 * add / remove roles from a GuildMember
	 * @param {import('discord.js').GuildMember} member
	 * @param {object} param1
	 * @param {import('discord.js').Collection<import('discord.js').Snowflake, import('discord.js').Role>} [param1.add]
	 * @param {import('discord.js').Collection<import('discord.js').Snowflake, import('discord.js').Role>} [param1.remove]
	 */
	static async editRoles(member, { add, remove }) {
		let roles = member.roles.cache;
		if (remove) roles = roles.filter((_, id) => !remove.has(id));
		if (add) roles = roles.concat(add);

		return this.setRoles(member, roles);
	}

	/**
	 * @param {import('discord.js').GuildMember} member
	 * @param {string | import('discord.js').MessageOptions} contentOrOptions
	 */
	static async sendDM(member, contentOrOptions) {
		return UserUtil.sendDM(member.user, contentOrOptions);
	}
}
