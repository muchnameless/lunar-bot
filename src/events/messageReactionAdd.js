import { BROADCAST_EMOJI } from '../constants/index.js';
import { logger } from '../functions/index.js';
import { Event } from '../structures/events/Event.js';


export default class MessageReactionAddEvent extends Event {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param {import('discord.js').MessageReaction} reaction
	 * @param {import('discord.js').User} user
	 */
	async run(reaction, { id: userId }) {
	// reaction.message is not from the announcement channel or not the broadcast emoji
		if (reaction.message.channelId !== this.config.get('GUILD_ANNOUNCEMENTS_CHANNEL_ID') || reaction.emoji.name !== BROADCAST_EMOJI) return;

		try {
			if (reaction.partial) await reaction.fetch();
			if (reaction.message.partial) await reaction.message.fetch();
		} catch (error) {
			return logger.error('[MESSAGE REACTION ADD]: error while fetching partial', error);
		}

		if (userId === reaction.message.author.id) return this.client.chatBridges.handleAnnouncementMessage(reaction.message);
	}
}
