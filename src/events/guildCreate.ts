import { GuildUtil } from '../util';
import { logger } from '../functions';
import { Event } from '../structures/events/Event';
import type { Guild } from 'discord.js';
import type { EventContext } from '../structures/events/BaseEvent';

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

		if (!this.client.options.fetchAllMembers) return;

		try {
			const members = await GuildUtil.fetchAllMembers(guild);
			logger.info(`[GUILD CREATE]: fetched ${members.size} members`);
		} catch (error) {
			logger.error(error, '[GUILD CREATE]');
		}
	}
}
