'use strict';

const { MessageEmbed } = require('discord.js');
const { stripIndents } = require('common-tags');


// check discord members that left for id in player database
module.exports = async (client, member) => {
	const { config } = client;

	if (member.guild.id !== config.get('DISCORD_GUILD_ID')) return;

	const { user } = member;
	const player = client.players.getByID(user.id);

	if (!player) return;

	player.inDiscord = false;
	player.save();

	client.log(new MessageEmbed()
		.setColor(config.get('EMBED_RED'))
		.setAuthor(user.tag, user.displayAvatarURL({ dynamic: true }), player.url)
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
