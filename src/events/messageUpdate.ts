import { PermissionFlagsBits } from 'discord.js';
import { ChannelUtil } from '../util';
import { logger, minutes } from '../functions';
import MessageCreateEvent from './messageCreate';
import type { Message } from 'discord.js';
import type { EventContext } from '../structures/events/Event';

export default class MessageUpdateEvent extends MessageCreateEvent {
	constructor(context: EventContext) {
		super(context, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param oldMessage
	 * @param newMessage
	 */
	// @ts-expect-error
	override async run(oldMessage: Message, newMessage: Message) {
		if (
			Date.now() - newMessage.createdTimestamp >= minutes(10) || // original message is older than 10 min
			(oldMessage.content === newMessage.content && newMessage.content) || // pinned or embed added
			!ChannelUtil.botPermissions(newMessage.channel).has(PermissionFlagsBits.ViewChannel) // slash cmd response edits
		) {
			return;
		}

		if (newMessage.partial) {
			try {
				await newMessage.fetch();
			} catch (error) {
				return logger.error(error, '[CMD HANDLER]: error while fetching partial message');
			}
		}

		this._handleDiscordMessage(newMessage, true);
	}
}
