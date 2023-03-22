import { stripIndents } from 'common-tags';
import { ChannelType, codeBlock, EmbedBuilder, Events, type ClientEvents } from 'discord.js';
import { logger } from '#logger';
import { DiscordJSEvent } from '#structures/events/DiscordJSEvent.js';
import { EmbedUtil, GuildMemberUtil } from '#utils';

export default class extends DiscordJSEvent {
	public override readonly name = Events.GuildMemberRemove;

	/**
	 * event listener callback
	 *
	 * @param member
	 */
	public override run(member: ClientEvents[Events.GuildMemberRemove][0]) {
		// uncache user
		if (
			!this.client.guilds.cache.some((guild) => guild.members.cache.has(member.id)) &&
			this.client.channels.cache.some((channel) => channel.type === ChannelType.DM && channel.recipientId === member.id)
		) {
			this.client.users.cache.delete(member.id);
		}

		// check discord members that left for id in player database
		const player = GuildMemberUtil.getPlayer(member);

		// member is not from the hypixel guild's discord guild
		if (player?.hypixelGuild?.discordId !== member.guild.id) return;

		// uncaches the member as well
		player
			.update({ inDiscord: false })
			.catch((error) =>
				logger.error(
					{ err: error, player: player.logInfo, member: GuildMemberUtil.logInfo(member) },
					'[GUILD MEMBER REMOVE]',
				),
			);

		void this.client.log(
			EmbedUtil.padFields(
				new EmbedBuilder()
					.setColor(this.config.get('EMBED_RED'))
					.setAuthor({ name: member.user.tag, iconURL: member.displayAvatarURL(), url: player.url })
					.setThumbnail(player.imageURL)
					.setDescription(
						stripIndents`
							${member} left the discord server
							${player.info}
						`,
					)
					.addFields({
						name: 'Roles',
						value: codeBlock(
							member.roles.cache
								.filter(({ id }) => id !== member.guild.id)
								.sort((a, b) => b.comparePositionTo(a))
								.map(({ name }) => name)
								.join('\n'),
						),
					})
					.setTimestamp(),
				2,
			),
		);
	}
}
