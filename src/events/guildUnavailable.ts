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
	override async run(guild: Guild) {
		logger.info(`[GUILD UNAVAILABLE]: ${guild.name}`);

		// sweep linked discord members cache
		if (guild.id === this.config.get('DISCORD_GUILD_ID')) this.client.players.sweepDiscordMemberCache();
	}
}
