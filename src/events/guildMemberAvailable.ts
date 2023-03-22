import { Events, type ClientEvents } from 'discord.js';
import { logger } from '#logger';
import { DiscordJSEvent } from '#structures/events/DiscordJSEvent.js';
import { GuildUtil } from '#utils';

export default class extends DiscordJSEvent {
	public override readonly name = Events.GuildMemberAvailable;

	/**
	 * event listener callback
	 *
	 * @param member
	 */
	public override async run(member: ClientEvents[Events.GuildMemberAvailable][0]) {
		const { size } = await GuildUtil.fetchAllMembers(member.guild);
		logger.info(`[GUILD MEMBER AVAILABLE]: fetched ${size} members`);
	}
}
