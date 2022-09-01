import { GuildUtil } from '#utils';
import { logger } from '#logger';
import { Event } from '#structures/events/Event';
import type { ClientEvents, Events } from 'discord.js';

export default class GuildCreateEvent extends Event {
	/**
	 * event listener callback
	 * @param guild
	 */
	override async run(guild: ClientEvents[Events.GuildCreate][0]) {
		logger.info(GuildUtil.logInfo(guild), '[GUILD CREATE]');

		const { size } = await GuildUtil.fetchAllMembers(guild);
		logger.info(`[GUILD CREATE]: fetched ${size} members`);
	}
}
