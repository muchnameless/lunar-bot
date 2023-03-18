import type { ClientEvents, Events } from 'discord.js';
import { logger } from '#logger';
import { Event } from '#structures/events/Event.js';
import { GuildUtil } from '#utils';

export default class GuildCreateEvent extends Event {
	/**
	 * event listener callback
	 *
	 * @param guild
	 */
	public override async run(guild: ClientEvents[Events.GuildCreate][0]) {
		logger.info(GuildUtil.logInfo(guild), '[GUILD CREATE]');

		const { size } = await GuildUtil.fetchAllMembers(guild);
		logger.info(`[GUILD CREATE]: fetched ${size} members`);
	}
}
