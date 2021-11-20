import { MessageEmbed } from 'discord.js';
import { stripIndents } from 'common-tags';
import { GuildMemberUtil } from '../util';
import { Event } from '../structures/events/Event';
import type { GuildMember } from 'discord.js';
import type { EventContext } from '../structures/events/BaseEvent';

export default class GuildMemberAddEvent extends Event {
	constructor(context: EventContext) {
		super(context, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param member
	 */
	override async run(member: GuildMember) {
		// check new discord members for tag in player database and link them if found
		const player = GuildMemberUtil.getPlayer(member);

		if (!player) return;

		player.link(member, 'linked player joined discord server');

		let description = stripIndents`
			${member} joined the discord server
			${player.info}
		`;

		const MANDATORY = this.client.hypixelGuilds.findByDiscordGuild(member.guild)?.roleIds.MANDATORY;

		if (MANDATORY && !member.roles.cache.has(MANDATORY)) {
			description += `\n\nwaiting for ${member.guild.roles.cache.get(MANDATORY) ?? MANDATORY} role`;
		}

		this.client.log(
			new MessageEmbed()
				.setColor(this.config.get('EMBED_GREEN'))
				.setAuthor({ name: member.user.tag, iconURL: member.displayAvatarURL({ dynamic: true }), url: player.url })
				.setThumbnail((await player.imageURL)!)
				.setDescription(description)
				.setTimestamp(),
		);
	}
}
