import { Events, type ClientEvents } from 'discord.js';
import { logger } from '#logger';
import { DiscordJSEvent } from '#structures/events/DiscordJSEvent.js';
import { GuildUtil } from '#utils';

export default class extends DiscordJSEvent {
	public override readonly name = Events.GuildCreate;

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
