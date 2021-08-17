import { MessageFlags, Permissions } from 'discord.js';
import { ChannelUtil } from '../util/ChannelUtil.js';
import MessageCreateEvent from './messageCreate.js';
import { logger } from '../functions/logger.js';


export default class MessageUpdateEvent extends MessageCreateEvent {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param {import('discord.js').Message} oldMessage
	 * @param {import('discord.js').Message} newMessage
	 */
	async run(oldMessage, newMessage) {
		// ignore ephemeral messages (slash cmd response edits)
		if (newMessage.flags.has(MessageFlags.FLAGS.EPHEMERAL)) return;

		if (
			Date.now() - newMessage.createdTimestamp >= 10 * 60_000 // original message is older than 10 min
			|| oldMessage.content === newMessage.content // pinned or embed added
			|| !ChannelUtil.botPermissions(newMessage.channel)?.has(Permissions.FLAGS.VIEW_CHANNEL) // slash cmd response edits
		) return;

		if (newMessage.partial) {
			try {
				await newMessage.fetch();
			} catch (error) {
				return logger.error('[CMD HANDLER]: error while fetching partial message', error);
			}
		}

		this._handleDiscordMessage(newMessage, true);
	}
}
