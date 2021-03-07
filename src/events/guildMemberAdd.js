'use strict';

const { MessageEmbed } = require('discord.js');
const { stripIndents } = require('common-tags');
// const logger = require('../functions/logger');


/**
 * guildMemberAdd
 * @param {import('../structures/LunarClient')} client
 * @param {import('../structures/extensions/GuildMember')} member
 */
module.exports = async (client, member) => {
	const { config } = client;

	if (member.guild.id !== config.get('DISCORD_GUILD_ID')) return;

	// check new discord members for tag in player database and link them if found
	/**
	 * @type {import()}
	 */
	const player = member.player ?? client.players.getByID(member.user.tag);

	if (!player) return;

	player.link(member, 'linked player joined discord server');

	let description = stripIndents`
		${member} joined the discord server
		${player.info}
	`;

	if (!member.roles.cache.has(config.get('VERIFIED_ROLE_ID'))) {
		description += `\n\nwaiting for ${member.guild.roles.cache.get(config.get('VERIFIED_ROLE_ID')) ?? config.get('VERIFIED_ROLE_ID')} role`;
	}

	client.log(new MessageEmbed()
		.setColor(config.get('EMBED_GREEN'))
		.setAuthor(member.user.tag, member.user.displayAvatarURL({ dynamic: true }), player.url)
		.setThumbnail(player.image)
		.setDescription(description)
		.setTimestamp(),
	);
};
