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
	 * wether all guild members are currently being fetched
	 */
	static IS_FETCHING = false;

	/**
	 * event listener callback
	 * @param {import('discord.js').GuildMember} member
	 */
	async run(member) {
		if (member.guild.id !== this.config.get('DISCORD_GUILD_ID') || !this.client.options.fetchAllMembers) return;

		if (GuildMemberAvailableEvent.IS_FETCHING) return;
		GuildMemberAvailableEvent.IS_FETCHING = true;

		try {
			const members = await this.client.fetchAllGuildMembers(member.guild);
			logger.info(`[GUILD MEMBER AVAILABLE]: fetched ${members.size} members`);
		} catch (error) {
			logger.error('[GUILD MEMBER AVAILABLE]', error);
		} finally {
			GuildMemberAvailableEvent.IS_FETCHING = false;
		}
	}
}
