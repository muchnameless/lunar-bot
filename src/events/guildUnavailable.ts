import { setInterval, clearInterval } from 'node:timers';
import { Events, type ClientEvents, type Snowflake } from 'discord.js';
import { minutes } from '#functions';
import { logger } from '#logger';
import { DiscordJSEvent } from '#structures/events/DiscordJSEvent.js';
import { GuildUtil } from '#utils';

export default class GuildUnavailableEvent extends DiscordJSEvent {
	public override readonly name = Events.GuildUnavailable;

	private readonly _intervals = new Map<Snowflake, NodeJS.Timeout>();

	/**
	 * event listener callback
	 *
	 * @param guild
	 */
	public override run(guild: ClientEvents[Events.GuildUnavailable][0]) {
		logger.info(GuildUtil.logInfo(guild), '[GUILD UNAVAILABLE]');

		// sweep linked discord members cache
		for (const hypixelGuild of this.client.hypixelGuilds.cache.values()) {
			if (hypixelGuild.discordId !== guild.id) continue;

			// sweep discord member cache
			for (const player of hypixelGuild.players.values()) {
				void player.setDiscordMember(null, false);
			}
		}

		// refetch members
		const oldInterval = this._intervals.get(guild.id);
		if (oldInterval) clearInterval(oldInterval);

		const interval = setInterval(async () => {
			try {
				await GuildUtil.fetchAllMembers(guild);
				clearInterval(interval);
			} catch (error) {
				logger.error({ err: error, ...GuildUtil.logInfo(guild) }, '[GUILD UNAVAILABLE]');
			}
		}, minutes(5));

		this._intervals.set(guild.id, interval);
	}
}
