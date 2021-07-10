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
	 * @param {boolean} [isEdit=false]
	 */
	async _handleDiscordMessage(message, isEdit = false) {
		if (message.flags.has(MessageFlags.FLAGS.EPHEMERAL)) return;

		if (message.partial) {
			try {
				await message.fetch();
			} catch (error) {
				return logger.error('[CMD HANDLER]: error while fetching partial message', error);
			}
		}

		/**
		 * channel specific triggers
		 */
		if (message.channel.id === this.config.get('GUILD_ANNOUNCEMENTS_CHANNEL_ID')) message.react(FORWARD_TO_GC);

		/**
		 * chat bridge
		 */
		if (!message.interaction) this.client.chatBridges.handleDiscordMessage(message, { isEdit, checkIfNotFromBot: !isEdit }); // ignore empty messages (attachments, embeds), filter out bot, system & webhook messages

		if (message.content.length && message.isUserMessage) {
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
		return this._handleDiscordMessage(message, false);
	}
};
