import { stripIndents } from 'common-tags';
import { EmbedBuilder, Events, type ClientEvents } from 'discord.js';
import { logger } from '#logger';
import { DiscordJSEvent } from '#structures/events/DiscordJSEvent.js';
import { GuildMemberUtil } from '#utils';

export default class GuildMemberAddEvent extends DiscordJSEvent {
	public override readonly name = Events.GuildMemberAdd;

	/**
	 * event listener callback
	 *
	 * @param member
	 */
	public override run(member: ClientEvents[Events.GuildMemberAdd][0]) {
		// check new discord members for tag in player database and link them if found
		const player = GuildMemberUtil.getPlayer(member);

		if (!player) return;

		player
			.link(member, 'linked player joined discord server')
			.catch((error) =>
				logger.error(
					{ err: error, player: player.logInfo, member: GuildMemberUtil.logInfo(member) },
					'[GUILD MEMBER ADD]',
				),
			);

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
