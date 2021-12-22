import { MessageEmbed, Formatters } from 'discord.js';
import { stripIndents } from 'common-tags';
import { logger } from '../functions';
import { GuildMemberUtil, MessageEmbedUtil } from '../util';
import { Event } from '../structures/events/Event';
import type { GuildMember } from 'discord.js';
import type { EventContext } from '../structures/events/BaseEvent';

export default class GuildMemberRemoveEvent extends Event {
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
		// uncache user
		if (
			!this.client.guilds.cache.some((guild) => guild.members.cache.has(member.id)) &&
			this.client.channels.cache.some((channel) => channel.type === 'DM' && channel.recipient.id === member.id)
		) {
			this.client.users.cache.delete(member.id);
		}

		// check discord members that left for id in player database
		const player = GuildMemberUtil.getPlayer(member);

		// member is not from the hypixel guild's discord guild
		if (player?.hypixelGuild?.discordId !== member.guild.id) return;

		// uncaches the member as well
		player.update({ inDiscord: false }).catch((error) => logger.error(error));

		this.client.log(
			MessageEmbedUtil.padFields(
				new MessageEmbed()
					.setColor(this.config.get('EMBED_RED'))
					.setAuthor({ name: member.user.tag, iconURL: member.displayAvatarURL({ dynamic: true }), url: player.url })
					.setThumbnail((await player.imageURL)!)
					.setDescription(
						stripIndents`
							${member} left the discord server
							${player.info}
						`,
					)
					.addFields({
						name: 'Roles',
						value: Formatters.codeBlock(
							member.roles?.cache
								.filter(({ id }) => id !== member.guild.id)
								.sort((a, b) => b.comparePositionTo(a))
								.map(({ name }) => name)
								.join('\n') ?? 'unknown',
						),
					})
					.setTimestamp(),
				2,
			),
		);
	}
}
