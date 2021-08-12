'use strict';

const { skills, slayers } = require('../constants/skyblock');
const { delimiterRoles, skillAverageRoles, skillRoles, slayerTotalRoles, slayerRoles, catacombsRoles } = require('../constants/roles');
const UserUtil = require('./UserUtil');
// const logger = require('../functions/logger');


module.exports = class GuildMemberUtil extends null {
	/**
	 * @param {import('discord.js').GuildMember} member
	 */
	static getPlayer(member) {
		return UserUtil.getPlayer(member.user);
	}

	/**
	 * @param {import('discord.js').GuildMember} member
	 * @param {import('../structures/database/models/Player')} player
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
		for (const type of delimiterRoles) {
			if (member.roles.cache.has(config.get(`${type}_DELIMITER_ROLE_ID`))) rolesToRemove.push(config.get(`${type}_DELIMITER_ROLE_ID`));
		}

		// skill average
		for (const level of skillAverageRoles) {
			if (member.roles.cache.has(config.get(`AVERAGE_LVL_${level}_ROLE_ID`))) rolesToRemove.push(config.get(`AVERAGE_LVL_${level}_ROLE_ID`));
		}

		// individual skills
		for (const skill of skills) {
			for (const level of skillRoles) {
				if (member.roles.cache.has(config.get(`${skill}_${level}_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_${level}_ROLE_ID`));
			}
		}

		// total slayer
		for (const level of slayerTotalRoles) {
			if (member.roles.cache.has(config.get(`SLAYER_ALL_${level}_ROLE_ID`))) rolesToRemove.push(config.get(`SLAYER_ALL_${level}_ROLE_ID`));
		}

		// individual slayer
		for (const slayer of slayers) {
			for (const level of slayerRoles) {
				if (member.roles.cache.has(config.get(`${slayer}_${level}_ROLE_ID`))) rolesToRemove.push(config.get(`${slayer}_${level}_ROLE_ID`));
			}
		}

		// catacombs
		for (const level of catacombsRoles) {
			if (member.roles.cache.has(config.get(`CATACOMBS_${level}_ROLE_ID`))) rolesToRemove.push(config.get(`CATACOMBS_${level}_ROLE_ID`));
		}

		return rolesToRemove;
	}
};
