import { MessageUtil, UserUtil } from '#utils';
import { Event } from '#structures/events/Event';
import { UnicodeEmoji } from '#constants';
import type { ClientEvents, Events, Message } from 'discord.js';

export default class MessageCreateEvent extends Event {
	/**
	 * @param message
	 * @param isEdit
	 */
	_handleDiscordMessage(message: Message, isEdit = false) {
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
	 * @param message
	 */
	override run(message: ClientEvents[Events.MessageCreate][0]) {
		return this._handleDiscordMessage(message, false);
	}
}
