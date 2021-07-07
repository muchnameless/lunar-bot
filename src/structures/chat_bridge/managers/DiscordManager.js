'use strict';

const { Collection, Util: { escapeMarkdown } } = require('discord.js');
const { nameToUnicode } = require('../constants/emojiNameUnicodeConverter');
const { messageTypes: { GUILD } } = require('../constants/chatBridge');
const { autocorrect } = require('../../../functions/util');
const DiscordChatManager = require('./DiscordChatManager');
// const logger = require('../../../functions/logger');


module.exports = class DiscordManager {
	/**
	 * @param {import('../ChatBridge')} chatBridge
	 */
	constructor(chatBridge) {
		this.chatBridge = chatBridge;

		/**
		 * @type {Collection<string, DiscordChatManager>}
		 */
		this.channelsByIds = new Collection();
		/**
		 * @type {Collection<string, DiscordChatManager>}
		 */
		this.channelsByType = new Collection();
	}

	/**
	 * escapes '*' and '_' if those are neither within an URL nor a code block or inline code
	 * @param {string} string
	 * @param {number} [block=0]
	 */
	static _escapeNonURL(string, block = 0) {
		switch (block) {
			case 0:
				return string
					.split('```')
					.map((subString, index, array) => {
						if (index % 2 && index !== array.length - 1) return subString;
						return this._escapeNonURL(subString, 1);
					})
					.join('```');

			case 1:
				return string
					.split(/(?<=^|[^`])`(?=[^`]|$)/g)
					.map((subString, index, array) => {
						if (index % 2 && index !== array.length - 1) return subString;
						return this._escapeNonURL(subString, 2);
					})
					.join('`');

			case 2:
				return string
					.replace(/\*/g, '\\*') // escape italic 1/2
					.replace(/(\S*)_([^\s_]*)/g, (match, p1, p2) => { // escape italic 2/2 & underline
						if (/^https?:\/\/|^www\./i.test(match)) return match; // don't escape URLs
						if (p1.includes('<') || p2.includes('>')) return match; // don't escape emojis
						return `${p1.replace(/_/g, '\\_')}\\_${p2}`;
					});
		}
	}

	get client() {
		return this.chatBridge.client;
	}

	get channels() {
		return this.channelsByType;
	}

	get ready() {
		return this.channels.size
			? this.channels.every(channel => channel.ready)
			: false;
	}

	set ready(value) {
		for (const channel of this.channels.values()) {
			channel.ready = value;
		}
	}

	/**
	 * gets the discord chat manager for the respective HypixelMessage type
	 * @param {string} typeOrId
	 */
	get(typeOrId) {
		return this.channelsByType.get(typeOrId ?? GUILD) ?? this.channelsByIds.get(typeOrId);
	}

	/**
	 * resolves the input to a DiscordChatManager instance
	 * @param {string|DiscordChatManager} input
	 */
	resolve(input) {
		if (input instanceof DiscordChatManager) return input;
		return this.get(input);
	}

	/**
	 * instantiates the DiscordChatManagers
	 */
	async init() {
		const promises = [];

		for (const chatBridgeChannel of this.chatBridge.guild.chatBridgeChannels) {
			if (this.channelsByType.has(chatBridgeChannel.type)) continue; // prevents multiple instantiations of the same manager

			const channelManager = new DiscordChatManager(this.chatBridge, chatBridgeChannel);

			this.channelsByType.set(chatBridgeChannel.type, channelManager);
			this.channelsByIds.set(chatBridgeChannel.channelId, channelManager);

			promises.push(channelManager.init());
		}

		return Promise.all(promises);
	}

	/**
	 * custom or basic emoji search by name
	 * @param {string} fullMatch
	 * @param {string} inColon
	 * @returns {string}
	 */
	findEmojiByName(fullMatch, inColon) {
		const emoji = nameToUnicode[fullMatch.replace(/_/g, '').toLowerCase()];

		if (emoji) return emoji;

		const { value, similarity } = autocorrect(inColon, this.client.emojis.cache, 'name');

		if (similarity >= this.client.config.get('AUTOCORRECT_THRESHOLD')) return `${value}`;

		return fullMatch;
	}

	/**
	 * readable string -> discord markdown
	 * @param {string} string
	 */
	parseContent(string) {
		return DiscordManager._escapeNonURL(
			escapeMarkdown(
				string
					.replace(/(?<=^\s*)(?=>)/, '\\') // escape '>' at the beginning
					.replace( // emojis (custom and default)
						/(?<!<a?):(\S+):(?!\d{17,19}>)/g,
						(match, p1) => this.findEmojiByName(match, p1),
					)
					.replace( // emojis (custom and default)
						/(?<!<a?):(\S+?):(?!\d{17,19}>)/g,
						(match, p1) => this.findEmojiByName(match, p1),
					)
					.replace( // channels
						/#([a-z-]+)/gi,
						(match, p1) => this.client.lgGuild?.channels.cache.find(({ name }) => name === p1.toLowerCase())?.toString() ?? match,
					)
					.replace( // @mentions
						/(?<!<)@(!|&)?(\S+)(?!\d{17,19}>)/g,
						(match, p1, p2) => {
							switch (p1) {
								case '!': // members/users
									return this.client.lgGuild?.members.cache.find(({ displayName }) => displayName.toLowerCase() === p2.toLowerCase())?.toString() // members
											?? this.client.users.cache.find(({ username }) => username.toLowerCase() === p2.toLowerCase())?.toString() // users
											?? match;

								case '&': // roles
									return this.client.lgGuild?.roles.cache.find(({ name }) => name.toLowerCase() === p2.toLowerCase())?.toString() // roles
											?? match;

								default: { // players, members/users, roles
									const IGN = p2.replace(/\W/g, '').toLowerCase();

									if (!IGN.length) return match;

									const player = this.client.players.cache.find(({ ign }) => ign.toLowerCase() === IGN);

									if (player?.inDiscord) return `<@${player.discordId}>`; // player can be pinged

									return match;
								}
							}
						},
					),
				{
					codeBlock: false,
					inlineCode: false,
					codeBlockContent: false,
					inlineCodeContent: false,
					italic: false,
					underline: false,
				},
			),
		);
	}
};
