'use strict';

const { FORWARD_TO_GC } = require('../constants/emojiCharacters');
const { escapeRegex } = require('../functions/util');
const MessageUtil = require('../util/MessageUtil');
const Event = require('../structures/events/Event');
// const logger = require('../functions/logger');


module.exports = class MessageCreateEvent extends Event {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * @param {import('discord.js').Message} message
	 * @param {boolean} [isEdit=false]
	 */
	async _handleDiscordMessage(message, isEdit = false) {
		// channel specific triggers
		if (message.channelId === this.config.get('GUILD_ANNOUNCEMENTS_CHANNEL_ID')) {
			MessageUtil.react(message, FORWARD_TO_GC);
		}

		// chat bridge
		this.client.chatBridges.handleDiscordMessage(message, { isEdit, checkIfNotFromBot: !isEdit || Boolean(message.interaction) });

		// "old" commands
		if (MessageUtil.isUserMessage(message) && new RegExp(`^(?:${[ escapeRegex(this.config.get('PREFIXES')[0]), `<@!?${this.client.user.id}>` ].join('|')})`, 'i').test(message.content)) {
			message.reply('all commands have been converted to slash commands, type (not send) `/` to see them');
		}
	}

	/**
	 * event listener callback
	 * @param {import('discord.js').Message} message
	 */
	async run(message) {
		return this._handleDiscordMessage(message, false);
	}
};
