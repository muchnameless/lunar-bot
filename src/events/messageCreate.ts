import type { ClientEvents, Events, Message } from 'discord.js';
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
		if (message.interaction !== null && message.author.id !== this.client.user.id) {
			this.client.chatBridges.handleInteractionRepliesFromOtherBots(
				message as Message & { interaction: NonNullable<Message['interaction']> },
			);
		}

		// chat bridge
		this.client.chatBridges.handleDiscordMessage(message);

		// channel specific triggers
		if (
			this.client.hypixelGuilds.cache.some(({ announcementsChannelId }) => announcementsChannelId === message.channelId)
		) {
			void MessageUtil.react(message, UnicodeEmoji.Broadcast);
		}

		// player activity
		if (!message.author.bot) void UserUtil.getPlayer(message.author)?.update({ lastActivityAt: new Date() });
	}
}
