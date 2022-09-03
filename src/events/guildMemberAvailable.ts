import { type ClientEvents, type Events } from 'discord.js';
import { logger } from '#logger';
import { Event } from '#structures/events/Event.js';
import { GuildUtil } from '#utils';

export default class GuildMemberAvailableEvent extends Event {
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
