'use strict';

const Event = require('../structures/events/Event');
const logger = require('../functions/logger');


module.exports = class GuildUnavailableEvent extends Event {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param {import('../structures/extensions/Guild')} guild
	 */
	async run(guild) {
		logger.info(`[GUILD UNAVAILABLE]: ${guild.name}`);

		// sweep linked discord members cache
		if (guild.id === this.config.get('DISCORD_GUILD_ID')) this.client.players.sweepDiscordMemberCache();
	}
};
