import { setInterval, clearInterval } from 'node:timers';
import { type ClientEvents, type Events } from 'discord.js';
import { minutes } from '#functions';
import { logger } from '#logger';
import { Event } from '#structures/events/Event.js';
import { GuildUtil } from '#utils';

export default class GuildUnavailableEvent extends Event {
	/**
	 * event listener callback
	 *
	 * @param guild
	 */
	public override run(guild: ClientEvents[Events.GuildUnavailable][0]) {
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
