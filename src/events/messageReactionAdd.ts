import { BROADCAST_EMOJI } from '../constants';
import { logger } from '../functions';
import { Event } from '../structures/events/Event';
import type { Message, MessageReaction, User } from 'discord.js';
import type { EventContext } from '../structures/events/BaseEvent';


export default class MessageReactionAddEvent extends Event {
	constructor(context: EventContext) {
		super(context, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param reaction
	 * @param user
	 */
	override async run(reaction: MessageReaction, { id: userId }: User) {
	// reaction.message is not from the announcement channel or not the broadcast emoji
		if (reaction.message.channelId !== this.config.get('GUILD_ANNOUNCEMENTS_CHANNEL_ID') || reaction.emoji.name !== BROADCAST_EMOJI) return;

		try {
			if (reaction.partial) await reaction.fetch();
			if (reaction.message.partial) await reaction.message.fetch();
		} catch (error) {
			return logger.error(error, '[MESSAGE REACTION ADD]: error while fetching partial');
		}

		if (userId === reaction.message.author?.id) this.client.chatBridges.handleAnnouncementMessage(reaction.message as Message);
	}
}
