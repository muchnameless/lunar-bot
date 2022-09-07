import { type ClientEvents, type Events, type Message } from 'discord.js';
import { minutes } from '#functions';
import { logger } from '#logger';
import { Event } from '#structures/events/Event.js';

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
		// original message is older than 10 min
		if (
			newMessage.editedTimestamp !== null &&
			newMessage.editedTimestamp - newMessage.createdTimestamp >= minutes(10)
		) {
			return;
		}

		if (newMessage.partial) {
			try {
				await newMessage.fetch();
			} catch (error) {
				return logger.error(error, '[MESSAGE UPDATE]: error while fetching partial message');
			}
		}

		// pinned or embed added, newMessage.content check so the ChatBridge can react with "blocked" to embed only messages
		if (oldMessage.content === newMessage.content && newMessage.content) {
			return;
		}

		// chat bridge
		this.client.chatBridges.handleDiscordMessage(newMessage as Message);
	}
}
