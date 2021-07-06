'use strict';

const { MessageFlags } = require('discord.js');
const { FORWARD_TO_GC } = require('../constants/emojiCharacters');
const { escapeRegex } = require('../functions/util');
const Event = require('../structures/events/Event');
const logger = require('../functions/logger');


module.exports = class MessageCreateEvent extends Event {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * @param {import('../structures/extensions/Message')} message
	 */
	async _handleDiscordMessage(message) {
		try {
			if (message.partial && !message.flags.has(MessageFlags.FLAGS.EPHEMERAL)) await message.fetch();
		} catch (error) {
			return logger.error('[CMD HANDLER]: error while fetching partial message:\n', error);
		}

		/**
		 * channel specific triggers
		 */
		if (message.channel.id === this.config.get('GUILD_ANNOUNCEMENTS_CHANNEL_ID')) message.react(FORWARD_TO_GC);

		/**
		 * chat bridge
		 */
		this.client.chatBridges.handleDiscordMessage(message, { checkIfNotFromBot: true }); // ignore empty messages (attachments, embeds), filter out bot, system & webhook messages

		if (message.content.length && message.isUserMessage) {
			this.client.hypixelGuilds.checkIfRankRequestMessage(message);

			if (new RegExp(`^(?:${[ escapeRegex(this.config.get('PREFIX')), `<@!?${this.client.user.id}>` ].join('|')})`, 'i').test(message.content)) {
				message.reply('all commands have been converted to slash commands, type (not send) `/` to see them');
			}
		}
	}

	/**
	 * event listener callback
	 * @param {import('../structures/extensions/Message')} message
	 */
	async run(message) {
		return this._handleDiscordMessage(message);
	}
};
