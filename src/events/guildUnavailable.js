import { logger } from '../functions/index.js';
import { Event } from '../structures/events/Event.js';


export default class GuildUnavailableEvent extends Event {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param {import('discord.js').Guild} guild
	 */
	async run(guild) {
		logger.info(`[GUILD UNAVAILABLE]: ${guild.name}`);

		// sweep linked discord members cache
		if (guild.id === this.config.get('DISCORD_GUILD_ID')) this.client.players.sweepDiscordMemberCache();
	}
}
