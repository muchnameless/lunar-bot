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
		if (newMember.guild.id !== this.config.get('DISCORD_GUILD_ID')) return;

		// received bridger role -> update player db
		if (
			newMember.roles.cache.has(this.config.get('BRIDGER_ROLE_ID')) &&
			!oldMember.roles.cache.has(this.config.get('BRIDGER_ROLE_ID'))
		) {
			const player =
				GuildMemberUtil.getPlayer(newMember) ?? (await this.client.players.fetch({ discordId: newMember.id }));

			if (!player) {
				return logger.info(
					`[GUILD MEMBER UPDATE]: ${newMember.user.tag} received bridger role but was not in the player db`,
				);
			}

			logger.info(`[GUILD MEMBER UPDATE]: ${player} | ${newMember.user.tag} received bridger role`);

			if (!player.inGuild()) player.update({ guildId: GUILD_ID_BRIDGER }).catch((error) => logger.error(error));
		}

		const player = GuildMemberUtil.getPlayer(newMember);
		if (!player) return;

		player.discordMember = newMember;

		// changed nickname -> check if new name includes ign
		if (oldMember.nickname !== newMember.nickname) {
			player.syncIgnWithDisplayName(
				newMember.nickname !== null || // added or updated nickname
					(oldMember.nickname !== null && newMember.nickname === null), // removed nickname
			);
		}

		// changes in 'verified'-role
		const VERIFIED_ROLE_ID = this.config.get('VERIFIED_ROLE_ID');

		if (oldMember.roles.cache.has(VERIFIED_ROLE_ID)) {
			// member lost verified role -> log incident
			if (!newMember.roles.cache.has(VERIFIED_ROLE_ID)) {
				return this.client.log(
					new MessageEmbed()
						.setColor(this.config.get('EMBED_RED'))
						.setAuthor(newMember.user.tag, newMember.displayAvatarURL({ dynamic: true }), player.url)
						.setThumbnail((await player.imageURL)!)
						.setDescription(
							stripIndents`
								${newMember} lost ${newMember.guild.roles.cache.get(VERIFIED_ROLE_ID)} role
								${player.info}
							`,
						)
						.setTimestamp(),
				);
			}

			// member was given verified role -> update roles
		} else if (newMember.roles.cache.has(VERIFIED_ROLE_ID)) {
			return player.updateDiscordMember({
				reason: `received ${newMember.guild.roles.cache.get(VERIFIED_ROLE_ID)!.name} role`,
			});
		}
	}
}
