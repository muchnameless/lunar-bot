'use strict';

const { FORWARD_TO_GC } = require('../constants/emojiCharacters');
const { escapeRegex } = require('./util');
const logger = require('./logger');


/**
 * command handler
 * @param {import('../structures/extensions/Message')} message
 */
module.exports = async (message) => {
	try {
		if (message.partial) await message.fetch();
	} catch (error) {
		return logger.error('[CMD HANDLER]: error while fetching partial message:\n', error);
	}

	const { client } = message;

	/**
	 * channel specific triggers
	 */
	if (message.channel.id === client.config.get('GUILD_ANNOUNCEMENTS_CHANNEL_ID')) message.react(FORWARD_TO_GC);

	/**
	 * chat bridge
	 */
	client.chatBridges.handleDiscordMessage(message, { checkifNotFromBot: true }); // ignore empty messages (attachments, embeds), filter out bot, system & webhook messages

	if (message.content?.length && message.isUserMessage) {
		client.hypixelGuilds.checkIfRankRequestMessage(message);

		if (new RegExp(`^(?:${[ escapeRegex(client.config.get('PREFIX')), `<@!?${client.user.id}>` ].join('|')})`, 'i').test(message.content)) {
			message.reply('all commands have been converted to /commands, type `/` to see them');
		}
	}
};
