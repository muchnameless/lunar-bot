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
	override run(member: GuildMember) {
		// check new discord members for tag in player database and link them if found
		const player = GuildMemberUtil.getPlayer(member);

		if (!player) return;

		player.link(member, 'linked player joined discord server');

		// member is not from the hypixel guild's discord guild
		if (player?.hypixelGuild?.discordId !== member.guild.id) return;

		let description = stripIndents`
			${member} joined the discord server
			${player.info}
		`;

		const MANDATORY_ROLE_ID = this.client.discordGuilds.cache.get(member.guild.id)?.MANDATORY_ROLE_ID;

		if (MANDATORY_ROLE_ID && !member.roles.cache.has(MANDATORY_ROLE_ID)) {
			description += `\n\nwaiting for ${member.guild.roles.cache.get(MANDATORY_ROLE_ID) ?? MANDATORY_ROLE_ID} role`;
		}

		this.client.log(
			new MessageEmbed()
				.setColor(this.config.get('EMBED_GREEN'))
				.setAuthor({ name: member.user.tag, iconURL: member.displayAvatarURL({ dynamic: true }), url: player.url })
				.setThumbnail(player.imageURL)
				.setDescription(description)
				.setTimestamp(),
		);
	}
}
