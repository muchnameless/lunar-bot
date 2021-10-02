import { BROADCAST_EMOJI } from '../constants';
import { MessageUtil } from '../util';
import { escapeRegex } from '../functions';
import { Event } from '../structures/events/Event';
import type { Message } from 'discord.js';
import type { EventContext, EventData } from '../structures/events/BaseEvent';


export default class MessageCreateEvent extends Event {
	constructor(context: EventContext, data?: EventData) {
		super(context, data ?? {
			once: false,
			enabled: true,
		});
	}

	/**
	 * @param message
	 * @param isEdit
	 */
	_handleDiscordMessage(message: Message, isEdit = false) {
		// channel specific triggers
		if (message.channelId === this.config.get('GUILD_ANNOUNCEMENTS_CHANNEL_ID')) {
			MessageUtil.react(message, BROADCAST_EMOJI);
		}

		// chat bridge
		this.client.chatBridges.handleDiscordMessage(message, { isEdit });

		// "old" commands
		if (MessageUtil.isUserMessage(message) && new RegExp(`^(?:${[ escapeRegex(this.config.get('PREFIXES')[0]), `<@!?${this.client.user!.id}>` ].join('|')})`, 'i').test(message.content)) {
			MessageUtil.reply(message, 'all commands have been converted to slash commands, type (not send) `/` to see them');
		}
	}

	/**
	 * event listener callback
	 * @param message
	 */
	override run(message: Message) {
		return this._handleDiscordMessage(message, false);
	}
}
