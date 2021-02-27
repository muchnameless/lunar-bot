'use strict';

const { MessageEmbed } = require('discord.js');
const { stripIndents } = require('common-tags');
const logger = require('../functions/logger');


/**
 * guildMemberRemove
 * @param {import('../structures/LunarClient')} client
 * @param {import('../structures/extensions/GuildMember')} member
 */
module.exports = async (client, member) => {
	const { config } = client;

	if (member.guild.id !== config.get('DISCORD_GUILD_ID')) return;

	// check discord members that left for id in player database
	const player = member.player;

	if (!player) return;

	player.inDiscord = false;
	player.save();

	client.log(new MessageEmbed()
		.setColor(config.get('EMBED_RED'))
		.setAuthor(member.user.tag, member.user.displayAvatarURL({ dynamic: true }), player.url)
		.setThumbnail(player.image)
		.setDescription(stripIndents`
			${member} left the discord server
			${player.info}
		`)
		.addField(
			'Roles',
			`\`\`\`\n${member.roles?.cache.filter(role => role.id !== member.guild.id).sort((a, b) => b.comparePositionTo(a)).map(role => role.name).join('\n') ?? 'unknown'}\`\`\``,
		)
		.padFields(2)
		.setTimestamp(),
	);
};
