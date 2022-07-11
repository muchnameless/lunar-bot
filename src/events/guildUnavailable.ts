import { setInterval, clearInterval } from 'node:timers';
import { GuildUtil } from '#utils';
import { logger } from '#logger';
import { Event } from '#structures/events/Event';
import { minutes } from '#functions';
import type { Guild } from 'discord.js';

export default class GuildUnavailableEvent extends Event {
	/**
	 * event listener callback
	 * @param guild
	 */
	override run(guild: Guild) {
		logger.info(`[GUILD UNAVAILABLE]: ${guild.name}`);

		// sweep linked discord members cache
		for (const hypixelGuild of this.client.hypixelGuilds.cache.values()) {
			if (hypixelGuild.discordId !== guild.id) continue;

			// sweep discord member cache
			for (const player of hypixelGuild.players.values()) {
				void player.setDiscordMember(null, false);
			}
		}

		// refetch members
		const interval = setInterval(async () => {
			try {
				await GuildUtil.fetchAllMembers(guild);
				clearInterval(interval);
			} catch (error) {
				logger.error(error, `[GUILD UNAVAILABLE]: ${guild.name}`);
			}
		}, minutes(5));
	}
}
