'use strict';

const { MessageEmbed, GuildMember } = require('discord.js');
const { stripIndents } = require('common-tags');
const LunarClient = require('../structures/LunarClient');
const logger = require('../functions/logger');


/**
 * guildMemberAdd
 * @param {LunarClient} client
 * @param {GuildMember} member
 */
module.exports = async (client, member) => {
	const { config } = client;

	if (member.guild.id !== config.get('DISCORD_GUILD_ID')) return;

	// check new discord members for tag in player database and link them if found
	const { user } = member;
	const player = client.players.getByID(user.id) ?? client.players.getByID(user.tag);

	if (!player) return;

	player.link(member, 'linked player joined discord server');

	let description = stripIndents`
		${member} joined the discord server
		${player.info}
	`;

	if (!member.roles.cache.has(config.get('VERIFIED_ROLE_ID')))
		description += `\n\nwaiting for ${member.guild.roles.cache.get(config.get('VERIFIED_ROLE_ID')) ?? config.get('VERIFIED_ROLE_ID')} role`;

	client.log(new MessageEmbed()
		.setColor(config.get('EMBED_GREEN'))
		.setAuthor(user.tag, user.displayAvatarURL({ dynamic: true }), player.url)
		.setThumbnail(player.image)
		.setDescription(description)
		.setTimestamp(),
	);
};
