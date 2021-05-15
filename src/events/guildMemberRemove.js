'use strict';

const { MessageEmbed } = require('discord.js');
const { stripIndents } = require('common-tags');
// const logger = require('../functions/logger');


/**
 * guildMemberRemove
 * @param {import('../structures/LunarClient')} client
 * @param {import('../structures/extensions/GuildMember')} member
 */
module.exports = async (client, member) => {
	if (member.guild.id !== client.config.get('DISCORD_GUILD_ID')) return;

	// check discord members that left for id in player database
	const { player } = member;

	if (!player) return;

	player.inDiscord = false;
	player.save();

	client.log(new MessageEmbed()
		.setColor(client.config.get('EMBED_RED'))
		.setAuthor(member.user.tag, member.user.displayAvatarURL({ dynamic: true }), player.url)
		.setThumbnail(player.image)
		.setDescription(stripIndents`
			${member} left the discord server
			${player.info}
		`)
		.addField(
			'Roles',
			`\`\`\`\n${member.roles?.cache
				.filter(({ id }) => id !== member.guild.id)
				.sort((a, b) => b.comparePositionTo(a))
				.map(({ name }) => name)
				.join('\n')
				?? 'unknown'
			}\`\`\``,
		)
		.padFields(2)
		.setTimestamp(),
	);
};
