import { Events, type ClientEvents, type Message } from 'discord.js';
import { UnicodeEmoji } from '#constants';
import { logger } from '#logger';
import { DiscordJSEvent } from '#structures/events/DiscordJSEvent.js';

export default class MessageReactionAddEvent extends DiscordJSEvent {
	public override readonly name = Events.MessageReactionAdd;

	/**
	 * event listener callback
	 *
	 * @param reaction
	 * @param user
	 */
	public override async run(
		reaction: ClientEvents[Events.MessageReactionAdd][0],
		{ id: userId }: ClientEvents[Events.MessageReactionAdd][1],
	) {
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
