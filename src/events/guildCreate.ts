import { GuildUtil } from '../util';
import { logger } from '../logger';
import { Event, type EventContext } from '../structures/events/Event';
import type { Guild } from 'discord.js';

export default class GuildCreateEvent extends Event {
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
		logger.info(`[GUILD CREATE]: ${guild.name}`);

		const { size } = await GuildUtil.fetchAllMembers(guild);
		logger.info(`[GUILD CREATE]: fetched ${size} members`);
	}
}
