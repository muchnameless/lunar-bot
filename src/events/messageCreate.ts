import { type ClientEvents, type Events, type Message } from 'discord.js';
import { UnicodeEmoji } from '#constants';
import { Event } from '#structures/events/Event.js';
import { MessageUtil, UserUtil } from '#utils';

export default class MessageCreateEvent extends Event {
	/**
	 * @param message
	 * @param isEdit
	 */
	protected _handleDiscordMessage(message: Message, isEdit = false) {
		// chat bridge
		this.client.chatBridges.handleDiscordMessage(message, { isEdit });

		// channel specific triggers
		if (
			this.client.hypixelGuilds.cache.some(({ announcementsChannelId }) => announcementsChannelId === message.channelId)
		) {
			void MessageUtil.react(message, UnicodeEmoji.Broadcast);
		}

		// player activity
		void UserUtil.getPlayer(message.author)?.update({ lastActivityAt: new Date() });
	}

	/**
	 * event listener callback
	 *
	 * @param message
	 */
	public override run(message: ClientEvents[Events.MessageCreate][0]) {
		this._handleDiscordMessage(message, false);
	}
}
