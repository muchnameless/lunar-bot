import { GuildUtil } from '../util';
import { logger } from '../logger';
import { Event } from '../structures/events/Event';
import type { GuildMember } from 'discord.js';

export default class GuildMemberAvailableEvent extends Event {
	/**
	 * event listener callback
	 * @param member
	 */
	override async run(member: GuildMember) {
		const { size } = await GuildUtil.fetchAllMembers(member.guild);
		logger.info(`[GUILD MEMBER AVAILABLE]: fetched ${size} members`);
	}
}
