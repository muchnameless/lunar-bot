import { UnicodeEmoji } from '../constants';
import { MessageUtil, UserUtil } from '../util';
import { Event, type EventContext } from '../structures/events/Event';
import type { Message } from 'discord.js';
import type { EventData } from '../structures/events/BaseEvent';

export default class MessageCreateEvent extends Event {
	constructor(context: EventContext, data?: EventData) {
		super(
			context,
			data ?? {
				once: false,
				enabled: true,
			},
		);
	}

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
	override run(message: Message) {
		return this._handleDiscordMessage(message, false);
	}
}
