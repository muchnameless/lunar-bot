import { EmbedBuilder } from 'discord.js';
import { stripIndents } from 'common-tags';
import { GuildMemberUtil } from '#utils';
import { logger } from '#logger';
import { Event } from '#structures/events/Event';
import type { ClientEvents, Events } from 'discord.js';

export default class GuildMemberAddEvent extends Event {
	/**
	 * event listener callback
	 * @param member
	 */
	override run(member: ClientEvents[Events.GuildMemberAdd][0]) {
		// check new discord members for tag in player database and link them if found
		const player = GuildMemberUtil.getPlayer(member);

		if (!player) return;

		player.link(member, 'linked player joined discord server').catch((error) => logger.error(error));

		// member is not from the hypixel guild's discord guild
		if (player.hypixelGuild?.discordId !== member.guild.id) return;

		let description = stripIndents`
			${member} joined the discord server
			${player.info}
		`;

		const MANDATORY_ROLE_ID = this.client.discordGuilds.cache.get(member.guild.id)?.MANDATORY_ROLE_ID;

		if (MANDATORY_ROLE_ID && !member.roles.cache.has(MANDATORY_ROLE_ID)) {
			description += `\n\nwaiting for ${member.guild.roles.cache.get(MANDATORY_ROLE_ID) ?? MANDATORY_ROLE_ID} role`;
		}

		void this.client.log(
			new EmbedBuilder()
				.setColor(this.config.get('EMBED_GREEN'))
				.setAuthor({ name: member.user.tag, iconURL: member.displayAvatarURL(), url: player.url })
				.setThumbnail(player.imageURL)
				.setDescription(description)
				.setTimestamp(),
		);
	}
}
