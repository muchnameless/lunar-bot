import { stripIndents } from 'common-tags';
import { EmbedBuilder, type ClientEvents, type Events } from 'discord.js';
import { Event } from '#structures/events/Event.js';
import { GuildMemberUtil } from '#utils';

export default class GuildMemberUpdateEvent extends Event {
	/**
	 * event listener callback
	 *
	 * @param oldMember
	 * @param newMember
	 */
	public override async run(
		oldMember: ClientEvents[Events.GuildMemberUpdate][0],
		newMember: ClientEvents[Events.GuildMemberUpdate][1],
	) {
		const discordGuild = this.client.discordGuilds.cache.get(newMember.guild.id);
		if (!discordGuild) return;

		const player = GuildMemberUtil.getPlayer(newMember)!;
		const hypixelGuild = player?.hypixelGuild;

		// member is not from the hypixel guild's discord guild
		if (hypixelGuild?.discordId !== newMember.guild.id) return;

		void player.setDiscordMember(newMember);

		// changed nickname -> check if new name includes ign
		if (oldMember.nickname !== newMember.nickname) {
			void player.syncIgnWithDisplayName(true);
		}

		// guild member timeout change
		if (
			newMember.isCommunicationDisabled() &&
			(oldMember.communicationDisabledUntilTimestamp === null ||
				oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp)
		) {
			// muted
			void hypixelGuild.mute(player, newMember.communicationDisabledUntilTimestamp - Date.now());
		} else if (
			newMember.communicationDisabledUntilTimestamp === null &&
			oldMember.communicationDisabledUntilTimestamp !== null
		) {
			// manually unmuted
			void hypixelGuild.unmute(player, 0);
		}

		// changes in 'mandatory'-role
		if (discordGuild.MANDATORY_ROLE_ID) {
			if (oldMember.roles.cache.has(discordGuild.MANDATORY_ROLE_ID)) {
				// member lost mandatory role -> log incident
				if (!newMember.roles.cache.has(discordGuild.MANDATORY_ROLE_ID)) {
					return void this.client.log(
						new EmbedBuilder()
							.setColor(this.config.get('EMBED_RED'))
							.setAuthor({
								name: newMember.user.tag,
								iconURL: newMember.displayAvatarURL(),
								url: player.url,
							})
							.setThumbnail(player.imageURL)
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
				return void (await player.updateDiscordMember({
					reason: `received ${newMember.guild.roles.cache.get(discordGuild.MANDATORY_ROLE_ID)!.name} role`,
				}));
			}
		}
	}
}
