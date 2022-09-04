import { PermissionFlagsBits, type ClientEvents, type Events, type Message } from 'discord.js';
import MessageCreateEvent from './messageCreate.js';
import { minutes } from '#functions';
import { logger } from '#logger';
import { ChannelUtil } from '#utils';

export default class MessageUpdateEvent extends MessageCreateEvent {
	/**
	 * event listener callback
	 *
	 * @param oldMessage
	 * @param newMessage
	 */
	// @ts-expect-error override
	public override async run(
		oldMessage: ClientEvents[Events.MessageUpdate][0],
		newMessage: ClientEvents[Events.MessageUpdate][1],
	) {
		if (
			Date.now() - newMessage.createdTimestamp >= minutes(10) || // original message is older than 10 min
			(oldMessage.content === newMessage.content && newMessage.content) || // pinned or embed added
			!ChannelUtil.botPermissions(newMessage.channel).has(PermissionFlagsBits.ViewChannel, false) // slash cmd response edits
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

		this._handleDiscordMessage(newMessage as Message, true);
	}
}
