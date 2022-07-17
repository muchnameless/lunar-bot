import { GuildUtil } from '#utils';
import { logger } from '#logger';
import { Event } from '#structures/events/Event';
import type { ClientEvents, Events } from 'discord.js';

export default class GuildMemberAvailableEvent extends Event {
	/**
	 * event listener callback
	 * @param member
	 */
	override async run(member: ClientEvents[Events.GuildMemberAvailable][0]) {
		const { size } = await GuildUtil.fetchAllMembers(member.guild);
		logger.info(`[GUILD MEMBER AVAILABLE]: fetched ${size} members`);
	}
}
