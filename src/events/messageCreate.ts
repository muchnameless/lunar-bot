import { type ClientEvents, type Events } from 'discord.js';
import { UnicodeEmoji } from '#constants';
import { Event } from '#structures/events/Event.js';
import { MessageUtil, UserUtil } from '#utils';

export default class MessageCreateEvent extends Event {
	/**
	 * event listener callback
	 *
	 * @param message
	 */
	public override run(message: ClientEvents[Events.MessageCreate][0]) {
		// chat bridge
		this.client.chatBridges.handleDiscordMessage(message);

		// channel specific triggers
		if (
			this.client.hypixelGuilds.cache.some(({ announcementsChannelId }) => announcementsChannelId === message.channelId)
		) {
			void MessageUtil.react(message, UnicodeEmoji.Broadcast);
		}

		// player activity
		void UserUtil.getPlayer(message.author)?.update({ lastActivityAt: new Date() });
	}
}
