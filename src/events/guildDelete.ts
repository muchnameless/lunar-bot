import { Events, type ClientEvents } from 'discord.js';
import { logger } from '#logger';
import { DiscordJSEvent } from '#structures/events/DiscordJSEvent.js';
import { GuildUtil } from '#utils';

export default class extends DiscordJSEvent {
	public override readonly name = Events.GuildDelete;

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
