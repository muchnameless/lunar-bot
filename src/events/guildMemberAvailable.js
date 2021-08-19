import { GuildUtil } from '../util/GuildUtil.js';
import { Event } from '../structures/events/Event.js';
import { logger } from '../functions/logger.js';


export default class GuildMemberAvailableEvent extends Event {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param {import('discord.js').GuildMember} member
	 */
	async run(member) {
		if (member.guild.id !== this.config.get('DISCORD_GUILD_ID') || !this.client.options.fetchAllMembers) return;

		try {
			const members = await GuildUtil.fetchAllMembers(member.guild);
			logger.info(`[GUILD MEMBER AVAILABLE]: fetched ${members.size} members`);
		} catch (error) {
			logger.error('[GUILD MEMBER AVAILABLE]', error);
		}
	}
}
