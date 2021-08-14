import { MessageEmbed, Formatters } from 'discord.js';
import { stripIndents } from 'common-tags';
import { GuildMemberUtil } from '../util/GuildMemberUtil.js';
import { MessageEmbedUtil } from '../util/MessageEmbedUtil.js';
import { Event } from '../structures/events/Event.js';
// import { logger } from '../functions/logger.js';


export default class GuildMemberRemoveEvent extends Event {
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
		// uncache user
		if (!this.client.guilds.cache.some(guild => guild.members.cache.has(member.id)) && this.client.channels.cache.some(channel => channel.type === 'DM' && channel.recipient.id === member.id)) {
			this.client.users.cache.delete(member.id);
		}

		if (member.guild.id !== this.config.get('DISCORD_GUILD_ID')) return;

		// check discord members that left for id in player database
		const player = GuildMemberUtil.getPlayer(member);

		if (!player) return;

		player.inDiscord = false;
		player.save();

		this.client.log(MessageEmbedUtil.padFields(
			new MessageEmbed()
				.setColor(this.config.get('EMBED_RED'))
				.setAuthor(member.user.tag, member.user.displayAvatarURL({ dynamic: true }), player.url)
				.setThumbnail(player.image)
				.setDescription(stripIndents`
					${member} left the discord server
					${player.info}
				`)
				.addFields({
					name: 'Roles',
					value: Formatters.codeBlock(
						member.roles?.cache
							.filter(({ id }) => id !== member.guild.id)
							.sort((a, b) => b.comparePositionTo(a))
							.map(({ name }) => name)
							.join('\n')
						?? 'unknown',
					),
				})
				.setTimestamp(),
			2,
		));
	}
}
