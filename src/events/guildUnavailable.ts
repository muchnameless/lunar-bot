import { logger } from '../functions';
import { Event } from '../structures/events/Event';
import type { Guild } from 'discord.js';
import type { EventContext } from '../structures/events/BaseEvent';

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

			for (const player of hypixelGuild.players.values()) {
				player.uncacheMember(false);
			}
		}
	}
}
