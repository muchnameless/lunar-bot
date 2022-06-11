import { UnicodeEmoji } from '../constants';
import { logger } from '../logger';
import { Event } from '../structures/events/Event';
import type { Message, MessageReaction, User } from 'discord.js';

export default class MessageReactionAddEvent extends Event {
	/**
	 * event listener callback
	 * @param reaction
	 * @param user
	 */
	override async run(reaction: MessageReaction, { id: userId }: User) {
		// reaction.message is not from the announcement channel or not the broadcast emoji
		if (
			reaction.emoji.name !== UnicodeEmoji.Broadcast ||
			!this.client.hypixelGuilds.cache.some(
				({ announcementsChannelId }) => announcementsChannelId === reaction.message.channelId,
			)
		) {
			return;
		}

		try {
			if (reaction.partial) await reaction.fetch();
			if (reaction.message.partial) await reaction.message.fetch();
		} catch (error) {
			return logger.error(error, '[MESSAGE REACTION ADD]: error while fetching partial');
		}

		if (userId === reaction.message.author?.id) {
			void this.client.chatBridges.handleAnnouncementMessage(reaction.message as Message);
		}
	}
}
