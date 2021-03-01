'use strict';

const { Structures, GuildMember } = require('discord.js');
const { SKILLS, SLAYERS } = require('../../constants/skyblock');
const { delimiterRoles, skillAverageRoles, skillRoles, slayerTotalRoles, slayerRoles, catacombsRoles } = require('../../constants/roles');
const logger = require('../../functions/logger');


class LunarGuildMember extends GuildMember {
	constructor(...args) {
		super(...args);

		/**
		 * @type {import('../LunarClient')}
		 */
		this.client;
	}

	/**
	 * player object associated with the discord member
	 * @type {import('../database/models/Player')}
	 */
	get player() {
		return this.user.player;
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
		[
			...hypixelGuilds.cache.array().flatMap(hGuild => hGuild.ranks.map(rank => rank.roleID)),
			...hypixelGuilds.cache.map(hGuild => hGuild.roleID),
			config.get('GUILD_ROLE_ID'),
		].forEach(roleID => this.roles.cache.has(roleID) && rolesToRemove.push(roleID));

		// delimiter
		for (const type of delimiterRoles) {
			if (this.roles.cache.has(config.get(`${type}_DELIMITER_ROLE_ID`))) rolesToRemove.push(config.get(`${type}_DELIMITER_ROLE_ID`));
		}

		// skill average
		for (const level of skillAverageRoles) {
			if (this.roles.cache.has(config.get(`AVERAGE_LVL_${level}_ROLE_ID`))) rolesToRemove.push(config.get(`AVERAGE_LVL_${level}_ROLE_ID`));
		}

		// individual skills
		for (const skill of SKILLS) {
			for (const level of skillRoles) {
				if (this.roles.cache.has(config.get(`${skill}_${level}_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_${level}_ROLE_ID`));
			}
		}

		// total slayer
		for (const level of slayerTotalRoles) {
			if (this.roles.cache.has(config.get(`SLAYER_${level}_ROLE_ID`))) rolesToRemove.push(config.get(`SLAYER_${level}_ROLE_ID`));
		}

		// individual slayer
		for (const slayer of SLAYERS) {
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

Structures.extend('GuildMember', GuildMember => LunarGuildMember); // eslint-disable-line no-shadow, no-unused-vars

module.exports = LunarGuildMember;
