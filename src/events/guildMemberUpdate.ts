import { MessageEmbed } from 'discord.js';
import { stripIndents } from 'common-tags';
import { GUILD_ID_BRIDGER } from '../constants';
import { GuildMemberUtil } from '../util';
import { logger } from '../functions';
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

		let player = GuildMemberUtil.getPlayer(newMember);

		for (const hypixelGuildId of discordGuild.hypixelGuildIds) {
			const hypixelGuild = this.client.hypixelGuilds.cache.get(hypixelGuildId);
			if (!hypixelGuild) continue;

			// received bridger role -> update player db
			if (
				newMember.roles.cache.has(hypixelGuild.BRIDGER_ROLE_ID!) &&
				!oldMember.roles.cache.has(hypixelGuild.BRIDGER_ROLE_ID!)
			) {
				player ??= await this.client.players.fetch({ discordId: newMember.id });

				if (!player) {
					return logger.info(
						`[GUILD MEMBER UPDATE]: ${newMember.user.tag} received bridger role but was not in the player db`,
					);
				}

				logger.info(`[GUILD MEMBER UPDATE]: ${player} | ${newMember.user.tag} received bridger role`);

				if (!player.inGuild()) player.update({ guildId: GUILD_ID_BRIDGER }).catch((error) => logger.error(error));

				break;
			}
		}

		if (!player) return;

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
