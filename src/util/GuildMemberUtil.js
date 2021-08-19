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
}
