'use strict';

const { MessageEmbed } = require('discord.js');
const { stripIndents } = require('common-tags');
const GuildMemberUtil = require('../util/GuildMemberUtil');
const Event = require('../structures/events/Event');
// const logger = require('../functions/logger');


module.exports = class GuildMemberAddEvent extends Event {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
 	 * @param {import('discord.js').GuildMember} member
	 */
	async run(member) {
		if (member.guild.id !== this.config.get('DISCORD_GUILD_ID')) return;

		// check new discord members for tag in player database and link them if found
		const player = GuildMemberUtil.getPlayer(member);

		if (!player) return;

		player.link(member, 'linked player joined discord server');

		let description = stripIndents`
			${member} joined the discord server
			${player.info}
		`;

		if (!member.roles.cache.has(this.config.get('VERIFIED_ROLE_ID'))) {
			description += `\n\nwaiting for ${member.guild.roles.cache.get(this.config.get('VERIFIED_ROLE_ID')) ?? this.config.get('VERIFIED_ROLE_ID')} role`;
		}

		this.client.log(new MessageEmbed()
			.setColor(this.config.get('EMBED_GREEN'))
			.setAuthor(member.user.tag, member.user.displayAvatarURL({ dynamic: true }), player.url)
			.setThumbnail(player.image)
			.setDescription(description)
			.setTimestamp(),
		);
	}
};
