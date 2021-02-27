'use strict';

const { Structures, GuildMember } = require('discord.js');
const { SKILLS, SLAYERS } = require('../../constants/skyblock');
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
	 * player object associated with the discord user
	 */
	get player() {
		return this.user.player;
	}

	/**
	 * returns an array with the member's roles that the bot manages
	 * @returns {string[]}
	 */
	get rolesToPurge() {
		const { config,	hypixelGuilds } = this.client;
		const rolesToRemove = [];

		[
			config.get('GUILD_DELIMITER_ROLE_ID'),
			...hypixelGuilds.cache.array().flatMap(hGuild => hGuild.ranks.map(rank => rank.roleID)),
			config.get('GUILD_ROLE_ID'),
			...hypixelGuilds.cache.map(hGuild => hGuild.roleID),
			config.get('SKILL_DELIMITER_ROLE_ID'),
			config.get('AVERAGE_LVL_50_ROLE_ID'), config.get('AVERAGE_LVL_45_ROLE_ID'), config.get('AVERAGE_LVL_40_ROLE_ID'),
			config.get('SLAYER_DELIMITER_ROLE_ID'),
			config.get('SLAYER_999_ROLE_ID'), config.get('SLAYER_888_ROLE_ID'), config.get('SLAYER_777_ROLE_ID'),
			config.get('DUNGEON_DELIMITER_ROLE_ID'),
			config.get('CATACOMBS_35_ROLE_ID'), config.get('CATACOMBS_30_ROLE_ID'), config.get('CATACOMBS_25_ROLE_ID'), config.get('CATACOMBS_20_ROLE_ID'),
			config.get('MISC_DELIMITER_ROLE_ID'),
		].forEach(roleID => this.roles.cache.has(roleID) && rolesToRemove.push(roleID));

		SKILLS.forEach(skill => {
			if (this.roles.cache.has(config.get(`${skill}_60_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_60_ROLE_ID`));
			if (this.roles.cache.has(config.get(`${skill}_55_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_55_ROLE_ID`));
			if (this.roles.cache.has(config.get(`${skill}_50_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_50_ROLE_ID`));
			if (this.roles.cache.has(config.get(`${skill}_45_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_45_ROLE_ID`));
		});

		SLAYERS.forEach(slayer => {
			if (this.roles.cache.has(config.get(`${slayer}_9_ROLE_ID`))) rolesToRemove.push(config.get(`${slayer}_9_ROLE_ID`));
			if (this.roles.cache.has(config.get(`${slayer}_8_ROLE_ID`))) rolesToRemove.push(config.get(`${slayer}_8_ROLE_ID`));
		});

		return rolesToRemove;
	}
}

Structures.extend('GuildMember', GuildMember => LunarGuildMember); // eslint-disable-line no-shadow, no-unused-vars

module.exports = LunarGuildMember;
