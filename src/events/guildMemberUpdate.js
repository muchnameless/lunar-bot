'use strict';

const { MessageEmbed } = require('discord.js');
const { stripIndents } = require('common-tags');
const { GUILD_ID_BRIDGER } = require('../constants/database');
const logger = require('../functions/logger');


/**
 * guildMemberUpdate
 * @param {import('../structures/LunarClient')} client
 * @param {import('../structures/extensions/GuildMember')} oldMember
 * @param {import('../structures/extensions/GuildMember')} newMember
 */
module.exports = async (client, oldMember, newMember) => {
	const { config } = client;

	if (newMember.guild.id !== config.get('DISCORD_GUILD_ID')) return;

	// received bridger role -> update player db
	const BRIDGER_ROLE_ID = config.get('BRIDGER_ROLE_ID');

	if (!oldMember.roles.cache.has(BRIDGER_ROLE_ID) && newMember.roles.cache.has(BRIDGER_ROLE_ID)) {
		const player = newMember.player ?? await client.players.model.findOne({ where: { discordID: newMember.id } });

		if (!player) return logger.info(`[GUILD MEMBER UPDATE]: ${newMember.user.tag} received bridger role but was not in the player db`);

		logger.info(`[GUILD MEMBER UPDATE]: ${player.ign} | ${newMember.user.tag} received bridger role`);

		player.guildID = GUILD_ID_BRIDGER;
		player.save();

		client.players.set(player.minecraftUUID, player);
	}

	const { player } = newMember;

	if (!player) return;

	player.discordMember = newMember;

	// changed username or nickname -> check if new name includes ign
	if (oldMember.displayName !== newMember.displayName) player.syncIgnWithDisplayName(newMember.nickname !== null || (oldMember.nickname !== null && newMember.nickname === null));

	// changes in 'verified'-role
	const VERIFIED_ROLE_ID = config.get('VERIFIED_ROLE_ID');

	if (oldMember.roles.cache.has(VERIFIED_ROLE_ID)) {
		// member lost verified role -> log incident
		if (!newMember.roles.cache.has(VERIFIED_ROLE_ID)) {
			return client.log(new MessageEmbed()
				.setColor(config.get('EMBED_RED'))
				.setAuthor(newMember.user.tag, newMember.user.displayAvatarURL({ dynamic: true }), player.url)
				.setThumbnail(player.image)
				.setDescription(stripIndents`
					${newMember} lost ${newMember.guild.roles.cache.get(VERIFIED_ROLE_ID)} role
					${player.info}
				`)
				.setTimestamp(),
			);
		}

	// member was given verified role -> update roles
	} else if (newMember.roles.cache.has(VERIFIED_ROLE_ID)) {
		return player.updateDiscordMember({ reason: `received ${newMember.guild.roles.cache.get(VERIFIED_ROLE_ID).name} role` });
	}
};
