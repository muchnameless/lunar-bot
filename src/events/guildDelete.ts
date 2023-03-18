import type { ClientEvents, Events } from 'discord.js';
import { logger } from '#logger';
import { Event } from '#structures/events/Event.js';
import { GuildUtil } from '#utils';

export default class GuildDeleteEvent extends Event {
	/**
	 * event listener callback
	 *
	 * @param guild
	 */
	public override run(guild: ClientEvents[Events.GuildDelete][0]) {
		logger.info(GuildUtil.logInfo(guild), '[GUILD DELETE]');

		this.client.permissions.cache.delete(guild.id);
	}
}
