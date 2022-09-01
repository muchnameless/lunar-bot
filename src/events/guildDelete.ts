import { logger } from '#logger';
import { Event } from '#structures/events/Event';
import { GuildUtil } from '#utils';
import type { ClientEvents, Events } from 'discord.js';

export default class GuildDeleteEvent extends Event {
	/**
	 * event listener callback
	 * @param guild
	 */
	override run(guild: ClientEvents[Events.GuildDelete][0]) {
		logger.info(GuildUtil.logInfo(guild), '[GUILD DELETE]');

		this.client.permissions.cache.delete(guild.id);
	}
}
