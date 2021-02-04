'use strict';

const { MessageEmbed } = require('discord.js');
const { stripIndents } = require('common-tags');


// force minecraft guild members to include their ign somewhere in their displayName
module.exports = async (client, oldMember, newMember) => {
	const { config } = client;

	if (newMember.guild.id !== config.get('DISCORD_GUILD_ID')) return;

	const player = client.players.getByID(newMember.user.id);

	if (!player) return;

	player.discordMember = newMember;

	// changed username or nickname -> check if new name includes ign
	if (oldMember.displayName !== newMember.displayName) player.syncIgnWithDisplayName(oldMember.nickname !== null);

	const VERIFIED_ROLE_ID = config.get('VERIFIED_ROLE_ID');

	// member was given verified role -> update roles
	if (!oldMember.roles.cache.has(VERIFIED_ROLE_ID) && newMember.roles.cache.has(VERIFIED_ROLE_ID))
		return player.updateRoles(`received ${newMember.guild.roles.cache.get(VERIFIED_ROLE_ID).name} role`);

	// member lost verified role -> log incident
	if (oldMember.roles.cache.has(VERIFIED_ROLE_ID) && !newMember.roles.cache.has(VERIFIED_ROLE_ID))
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
};
