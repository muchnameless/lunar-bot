import { GuildUtil } from '../util';
import { logger } from '../functions';
import { Event } from '../structures/events/Event';
import type { GuildMember } from 'discord.js';
import type { EventContext } from '../structures/events/BaseEvent';


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
		if (member.guild.id !== this.config.get('DISCORD_GUILD_ID') || !this.client.options.fetchAllMembers) return;

		try {
			const members = await GuildUtil.fetchAllMembers(member.guild);
			logger.info(`[GUILD MEMBER AVAILABLE]: fetched ${members.size} members`);
		} catch (error) {
			logger.error(error, '[GUILD MEMBER AVAILABLE]');
		}
	}
}
