import { MessageEmbed } from 'discord.js';
import { stripIndents } from 'common-tags';
import { GuildMemberUtil } from '../util';
import { Event } from '../structures/events/Event';
import type { GuildMember } from 'discord.js';
import type { EventContext } from '../structures/events/BaseEvent';

export default class GuildMemberUpdateEvent extends Event {
	constructor(context: EventContext) {
		super(context, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param oldMember
	 * @param newMember
	 */
	override async run(oldMember: GuildMember, newMember: GuildMember) {
		const discordGuild = this.client.discordGuilds.cache.get(newMember.guild.id);
		if (!discordGuild) return;

		const player = GuildMemberUtil.getPlayer(newMember);

		// member is not from the hypixel guild's discord guild
		if (player?.hypixelGuild?.discordId !== newMember.guild.id) return;

		player.setDiscordMember(newMember);

		// changed nickname -> check if new name includes ign
		if (oldMember.nickname !== newMember.nickname) {
			player.syncIgnWithDisplayName(
				newMember.nickname !== null || // added or updated nickname
					(oldMember.nickname !== null && newMember.nickname === null), // removed nickname
			);
		}

		// changes in 'mandatory'-role
		if (discordGuild.MANDATORY_ROLE_ID) {
			if (oldMember.roles.cache.has(discordGuild.MANDATORY_ROLE_ID)) {
				// member lost mandatory role -> log incident
				if (!newMember.roles.cache.has(discordGuild.MANDATORY_ROLE_ID)) {
					return this.client.log(
						new MessageEmbed()
							.setColor(this.config.get('EMBED_RED'))
							.setAuthor({
								name: newMember.user.tag,
								iconURL: newMember.displayAvatarURL({ dynamic: true }),
								url: player.url,
							})
							.setThumbnail((await player.imageURL)!)
							.setDescription(
								stripIndents`
									${newMember} lost ${newMember.guild.roles.cache.get(discordGuild.MANDATORY_ROLE_ID)} role
									${player.info}
								`,
							)
							.setTimestamp(),
					);
				}

				// member was given mandatory role -> update roles
			} else if (newMember.roles.cache.has(discordGuild.MANDATORY_ROLE_ID)) {
				return player.updateDiscordMember({
					reason: `received ${newMember.guild.roles.cache.get(discordGuild.MANDATORY_ROLE_ID)!.name} role`,
				});
			}
		}
	}
}
