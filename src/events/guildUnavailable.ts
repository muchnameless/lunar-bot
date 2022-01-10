import { setInterval } from 'node:timers';
import { logger, minutes } from '../functions';
import { Event, type EventContext } from '../structures/events/Event';
import { GuildUtil } from '../util';
import type { Guild } from 'discord.js';

export default class GuildUnavailableEvent extends Event {
	constructor(context: EventContext) {
		super(context, {
			once: false,
			enabled: true,
		});
	}

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
				player.setDiscordMember(null, false);
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
