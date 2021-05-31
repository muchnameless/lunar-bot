'use strict';

const { basename } = require('path');
const { Structures, GuildMember } = require('discord.js');
const { skills, slayers } = require('../../constants/skyblock');
const { delimiterRoles, skillAverageRoles, skillRoles, slayerTotalRoles, slayerRoles, catacombsRoles } = require('../../constants/roles');
// const logger = require('../../functions/logger');


class LunarGuildMember extends GuildMember {
	/**
	 * player object associated with the discord member
	 */
	get player() {
		return this.user.player;
	}

	/**
	 * player object associated with the discord member
	 */
	set player(value) {
		this.user.player = value;
	}

	/**
	 * hypixelGuild object associated with the discord member
	 */
	get hypixelGuild() {
		return this.player?.guild ?? null;
	}

	/**
	 * returns an array with the member's roles that the bot manages
	 * @returns {string[]}
	 */
	get rolesToPurge() {
		const { config,	hypixelGuilds } = this.client;
		const rolesToRemove = [];

		// guild
		for (const id of [
			...hypixelGuilds.cache.array().flatMap(hGuild => hGuild.ranks.map(({ roleID }) => roleID)),
			...hypixelGuilds.cache.map(({ roleID }) => roleID),
			config.get('GUILD_ROLE_ID'),
		]) this.roles.cache.has(id) && rolesToRemove.push(id);

		// delimiter
		for (const type of delimiterRoles) {
			if (this.roles.cache.has(config.get(`${type}_DELIMITER_ROLE_ID`))) rolesToRemove.push(config.get(`${type}_DELIMITER_ROLE_ID`));
		}

		// skill average
		for (const level of skillAverageRoles) {
			if (this.roles.cache.has(config.get(`AVERAGE_LVL_${level}_ROLE_ID`))) rolesToRemove.push(config.get(`AVERAGE_LVL_${level}_ROLE_ID`));
		}

		// individual skills
		for (const skill of skills) {
			for (const level of skillRoles) {
				if (this.roles.cache.has(config.get(`${skill}_${level}_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_${level}_ROLE_ID`));
			}
		}

		// total slayer
		for (const level of slayerTotalRoles) {
			if (this.roles.cache.has(config.get(`SLAYER_ALL_${level}_ROLE_ID`))) rolesToRemove.push(config.get(`SLAYER_ALL_${level}_ROLE_ID`));
		}

		// individual slayer
		for (const slayer of slayers) {
			for (const level of slayerRoles) {
				if (this.roles.cache.has(config.get(`${slayer}_${level}_ROLE_ID`))) rolesToRemove.push(config.get(`${slayer}_${level}_ROLE_ID`));
			}
		}

		// catacombs
		for (const level of catacombsRoles) {
			if (this.roles.cache.has(config.get(`CATACOMBS_${level}_ROLE_ID`))) rolesToRemove.push(config.get(`CATACOMBS_${level}_ROLE_ID`));
		}

		return rolesToRemove;
	}
}

Structures.extend(basename(__filename, '.js'), () => LunarGuildMember);

module.exports = LunarGuildMember;
