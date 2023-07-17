import { Events, type ClientEvents } from 'discord.js';
import { logger } from '#logger';
import { DiscordJSEvent } from '#structures/events/DiscordJSEvent.js';
import { GuildUtil } from '#utils';

export default class extends DiscordJSEvent {
	public override readonly name = Events.GuildAvailable;

	/**
	 * event listener callback
	 *
	 * @param guild
	 */
	public override async run(guild: ClientEvents[Events.GuildAvailable][0]) {
		const { size } = await GuildUtil.fetchAllMembers(guild);
		logger.info(`[GUILD AVAILABLE]: fetched ${size} members`);
	}
}
