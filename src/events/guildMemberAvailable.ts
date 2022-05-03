import { GuildUtil } from '../util';
import { logger } from '../logger';
import { Event, type EventContext } from '../structures/events/Event';
import type { GuildMember } from 'discord.js';

export default class GuildMemberAvailableEvent extends Event {
	constructor(context: EventContext) {
		super(context, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param member
	 */
	override async run(member: GuildMember) {
		const { size } = await GuildUtil.fetchAllMembers(member.guild);
		logger.info(`[GUILD MEMBER AVAILABLE]: fetched ${size} members`);
	}
}
