import { MessageEmbed } from 'discord.js';
import { stripIndents } from 'common-tags';
import { GuildMemberUtil } from '../util';
import { Event } from '../structures/events/Event';
import type { GuildMember, HexColorString, Snowflake } from 'discord.js';
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
		if (member.guild.id !== this.config.get('DISCORD_GUILD_ID')) return;

		// check new discord members for tag in player database and link them if found
		const player = GuildMemberUtil.getPlayer(member);

		if (!player) return;

		player.link(member, 'linked player joined discord server');

		let description = stripIndents`
			${member} joined the discord server
			${player.info}
		`;

		if (!member.roles.cache.has(this.config.get('VERIFIED_ROLE_ID') as Snowflake)) {
			description += `\n\nwaiting for ${member.guild.roles.cache.get(this.config.get('VERIFIED_ROLE_ID') as Snowflake) ?? this.config.get('VERIFIED_ROLE_ID') as Snowflake} role`;
		}

		this.client.log(
			new MessageEmbed()
				.setColor(this.config.get('EMBED_GREEN') as HexColorString)
				.setAuthor(member.user.tag, member.user.displayAvatarURL({ dynamic: true }), player.url)
				.setThumbnail((await player.imageURL)!)
				.setDescription(description)
				.setTimestamp(),
		);
	}
}
