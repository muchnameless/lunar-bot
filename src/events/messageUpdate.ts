import type { ClientEvents, Events, Message } from 'discord.js';
import { minutes } from '#functions';
import { logger } from '#logger';
import { Event } from '#structures/events/Event.js';
import { UserUtil } from '#utils';

export default class MessageUpdateEvent extends Event {
	/**
	 * event listener callback
	 *
	 * @param oldMessage
	 * @param newMessage
	 */
	public override async run(
		oldMessage: ClientEvents[Events.MessageUpdate][0],
		newMessage: ClientEvents[Events.MessageUpdate][1],
	) {
		if (newMessage.partial) {
			try {
				await newMessage.fetch();
			} catch (error) {
				return logger.error(error, '[MESSAGE UPDATE]: error while fetching partial message');
			}
		}

		// player activity
		if (!newMessage.author!.bot) void UserUtil.getPlayer(newMessage.author)?.update({ lastActivityAt: new Date() });

		// original message is older than 10 min
		if (
			newMessage.editedTimestamp !== null &&
			newMessage.editedTimestamp - newMessage.createdTimestamp >= minutes(10)
		) {
			return;
		}

		// check if the content has changed or embeds or attachments were added
		if (
			oldMessage.content === newMessage.content &&
			(newMessage.content || oldMessage.embeds.length === newMessage.embeds.length) &&
			oldMessage.attachments.size === newMessage.attachments.size
		) {
			return;
		}

		// chat bridge
		void this.client.chatBridges.handleDiscordMessage(newMessage as Message);
	}
}
